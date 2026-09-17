"""KRAVIA structured document renderer.

The canonical source is structured JSON plus an immutable business-data snapshot.
PDF, DOCX, HTML and XLSX are deterministic output formats. This module deliberately
contains no business approval logic; the Office control plane must authorize and
freeze the template/input snapshot before calling the renderer.
"""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from hashlib import sha256
from html import escape
from io import BytesIO
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from jinja2 import StrictUndefined
from jinja2.sandbox import SandboxedEnvironment
from openpyxl import Workbook
from docx import Document as DocxDocument
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from pydantic import BaseModel, Field, field_validator
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


OutputFormat = Literal["PDF", "DOCX", "HTML", "XLSX"]
_ALLOWED_BLOCKS = {"heading", "paragraph", "key_value", "table", "bullet_list", "spacer", "page_break", "signature", "clause"}
_MIME = {
    "PDF": "application/pdf",
    "DOCX": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "HTML": "text/html; charset=utf-8",
    "XLSX": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
_EXT = {"PDF": "pdf", "DOCX": "docx", "HTML": "html", "XLSX": "xlsx"}


class DocumentRenderRequest(BaseModel):
    document_code: str = Field(min_length=2, max_length=160)
    title: str = Field(min_length=1, max_length=300)
    output_format: OutputFormat
    design_schema: dict[str, Any] = Field(default_factory=dict)
    content_schema: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    input_snapshot: dict[str, Any] = Field(default_factory=dict)
    clause_snapshot: dict[str, Any] = Field(default_factory=dict)
    clause_rules: list[dict[str, Any]] = Field(default_factory=list, max_length=200)

    @field_validator("content_schema")
    @classmethod
    def validate_blocks(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        for index, block in enumerate(value):
            kind = str(block.get("type", "")).strip().lower()
            if kind not in _ALLOWED_BLOCKS:
                raise ValueError(f"Unsupported document block at index {index}")
        return value


@dataclass(frozen=True)
class RenderedDocument:
    content: bytes
    mime_type: str
    extension: str
    sha256: str


_ENV = SandboxedEnvironment(undefined=StrictUndefined, autoescape=False)
_ENV.filters.clear()
_ENV.globals.clear()


def _lookup(data: dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _condition_matches(condition: Any, snapshot: dict[str, Any]) -> bool:
    if condition in (None, {}, []):
        return True
    if not isinstance(condition, dict):
        return False
    if "all" in condition:
        values = condition.get("all")
        return isinstance(values, list) and all(_condition_matches(item, snapshot) for item in values)
    if "any" in condition:
        values = condition.get("any")
        return isinstance(values, list) and any(_condition_matches(item, snapshot) for item in values)
    if "not" in condition:
        return not _condition_matches(condition.get("not"), snapshot)
    path = str(condition.get("field", "")).strip()
    if not path:
        return False
    actual = _lookup(snapshot, path)
    if condition.get("exists") is True:
        return actual is not None
    if condition.get("truthy") is True:
        return bool(actual)
    if "equals" in condition:
        return actual == condition.get("equals")
    if "not_equals" in condition:
        return actual != condition.get("not_equals")
    if "in" in condition:
        choices = condition.get("in")
        return isinstance(choices, list) and actual in choices
    return False


def _render_text(value: Any, snapshot: dict[str, Any]) -> str:
    if value is None:
        return ""
    text = str(value)
    if "{{" not in text and "{%" not in text:
        return text
    try:
        return _ENV.from_string(text).render(snapshot)
    except Exception as exc:
        raise ValueError(f"Document variable resolution failed: {exc}") from exc


def _render_nested(value: Any, snapshot: dict[str, Any]) -> Any:
    if isinstance(value, str):
        return _render_text(value, snapshot)
    if isinstance(value, list):
        return [_render_nested(item, snapshot) for item in value]
    if isinstance(value, dict):
        return {key: _render_nested(item, snapshot) for key, item in value.items()}
    return value


def compose_blocks(request: DocumentRenderRequest) -> list[dict[str, Any]]:
    """Resolve variables and freeze clause content without mutating source objects."""
    rule_by_code = {
        str(rule.get("clause_code", "")).strip(): rule
        for rule in request.clause_rules
        if isinstance(rule, dict) and str(rule.get("clause_code", "")).strip()
    }
    output: list[dict[str, Any]] = []
    for source in deepcopy(request.content_schema):
        kind = str(source.get("type", "")).lower()
        if kind == "clause":
            code = str(source.get("clause_code", "")).strip()
            rule = rule_by_code.get(code, {})
            if rule and not _condition_matches(rule.get("when"), request.input_snapshot):
                continue
            clause = request.clause_snapshot.get(code)
            if not isinstance(clause, dict) or not isinstance(clause.get("content"), str):
                raise ValueError(f"Published clause snapshot missing for {code}")
            output.append({
                "type": "paragraph",
                "text": _render_text(clause["content"], request.input_snapshot),
                "clause_code": code,
                "clause_version": clause.get("version"),
                "clause_hash": clause.get("content_hash"),
            })
            continue
        output.append(_render_nested(source, request.input_snapshot))
    return output


def _safe_number(value: Any, default: float, minimum: float, maximum: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return min(max(parsed, minimum), maximum)


def _pdf(request: DocumentRenderRequest, blocks: list[dict[str, Any]]) -> bytes:
    buffer = BytesIO()
    design = request.design_schema
    page_size = LETTER if str(design.get("page_size", "A4")).upper() == "LETTER" else A4
    margins = design.get("margins_mm") if isinstance(design.get("margins_mm"), dict) else {}
    left = _safe_number(margins.get("left"), 20, 5, 60) * mm
    right = _safe_number(margins.get("right"), 20, 5, 60) * mm
    top = _safe_number(margins.get("top"), 22, 5, 80) * mm
    bottom = _safe_number(margins.get("bottom"), 22, 5, 80) * mm
    doc = SimpleDocTemplate(buffer, pagesize=page_size, leftMargin=left, rightMargin=right, topMargin=top, bottomMargin=bottom, title=request.title)
    styles = getSampleStyleSheet()
    base_size = _safe_number(design.get("font_size"), 10.5, 8, 16)
    body = ParagraphStyle("KRAVIA_BODY", parent=styles["BodyText"], fontName="Helvetica", fontSize=base_size, leading=base_size * 1.45, spaceAfter=6)
    headings = {
        1: ParagraphStyle("KRAVIA_H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=max(base_size + 7, 16), leading=max(base_size + 11, 20), spaceAfter=10),
        2: ParagraphStyle("KRAVIA_H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=max(base_size + 4, 13), leading=max(base_size + 8, 17), spaceAfter=8),
        3: ParagraphStyle("KRAVIA_H3", parent=styles["Heading3"], fontName="Helvetica-Bold", fontSize=max(base_size + 2, 11), leading=max(base_size + 6, 15), spaceAfter=6),
    }
    story: list[Any] = []
    for block in blocks:
        kind = str(block.get("type", "")).lower()
        if kind == "heading":
            level = max(1, min(int(block.get("level", 1)), 3)); story.append(Paragraph(escape(str(block.get("text", ""))).replace("\n", "<br/>"), headings[level]))
        elif kind == "paragraph":
            story.append(Paragraph(escape(str(block.get("text", ""))).replace("\n", "<br/>"), body))
        elif kind == "key_value":
            rows = [[escape(str(item.get("label", ""))), escape(str(item.get("value", "")))] for item in block.get("items", []) if isinstance(item, dict)]
            if rows:
                table = Table(rows, colWidths=[45 * mm, None]); table.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTNAME", (1, 0), (1, -1), "Helvetica"), ("FONTSIZE", (0, 0), (-1, -1), base_size), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)])); story.append(table); story.append(Spacer(1, 5))
        elif kind == "table":
            rows = block.get("rows", []); normalized = [[str(cell) for cell in row] for row in rows if isinstance(row, list)]
            if normalized:
                table = Table(normalized, repeatRows=1 if block.get("header", True) else 0); table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), .35, colors.grey), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTNAME", (0, 1), (-1, -1), "Helvetica"), ("FONTSIZE", (0, 0), (-1, -1), max(base_size - 1, 8)), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("PADDING", (0, 0), (-1, -1), 5)])); story.append(table); story.append(Spacer(1, 7))
        elif kind == "bullet_list":
            for item in block.get("items", []): story.append(Paragraph(f"• {escape(str(item))}", body))
        elif kind == "spacer": story.append(Spacer(1, _safe_number(block.get("height_mm"), 5, 0, 50) * mm))
        elif kind == "page_break": story.append(PageBreak())
        elif kind == "signature":
            label = escape(str(block.get("label", "Authorised Signatory"))); name = escape(str(block.get("name", ""))); story.append(Spacer(1, 16 * mm)); story.append(Paragraph(f"<b>{name or label}</b><br/>{label}", body))
    footer = str(design.get("footer_text", "")).strip()
    watermark = str(design.get("watermark", "")).strip()
    def canvas_footer(canvas, doc_obj):
        canvas.saveState()
        if footer:
            canvas.setFont("Helvetica", 8); canvas.setFillColor(colors.grey); canvas.drawCentredString(page_size[0] / 2, 10 * mm, footer[:220])
        canvas.setFont("Helvetica", 8); canvas.setFillColor(colors.grey); canvas.drawRightString(page_size[0] - right, 10 * mm, f"Page {doc_obj.page}")
        if watermark:
            canvas.setFillColor(colors.Color(0.75, 0.75, 0.75, alpha=0.16)); canvas.setFont("Helvetica-Bold", 42); canvas.translate(page_size[0] / 2, page_size[1] / 2); canvas.rotate(35); canvas.drawCentredString(0, 0, watermark[:80])
        canvas.restoreState()
    doc.build(story, onFirstPage=canvas_footer, onLaterPages=canvas_footer)
    return buffer.getvalue()


def _docx(request: DocumentRenderRequest, blocks: list[dict[str, Any]]) -> bytes:
    document = DocxDocument()
    design = request.design_schema
    section = document.sections[0]
    margins = design.get("margins_mm") if isinstance(design.get("margins_mm"), dict) else {}
    section.left_margin = Inches(_safe_number(margins.get("left"), 20, 5, 60) / 25.4)
    section.right_margin = Inches(_safe_number(margins.get("right"), 20, 5, 60) / 25.4)
    section.top_margin = Inches(_safe_number(margins.get("top"), 22, 5, 80) / 25.4)
    section.bottom_margin = Inches(_safe_number(margins.get("bottom"), 22, 5, 80) / 25.4)
    normal = document.styles["Normal"]; normal.font.name = "Arial"; normal.font.size = Pt(_safe_number(design.get("font_size"), 10.5, 8, 16))
    for block in blocks:
        kind = str(block.get("type", "")).lower()
        if kind == "heading": document.add_heading(str(block.get("text", "")), level=max(1, min(int(block.get("level", 1)), 3)))
        elif kind == "paragraph": document.add_paragraph(str(block.get("text", "")))
        elif kind == "key_value":
            items = [item for item in block.get("items", []) if isinstance(item, dict)]
            table = document.add_table(rows=len(items), cols=2)
            for idx, item in enumerate(items): table.cell(idx, 0).text = str(item.get("label", "")); table.cell(idx, 1).text = str(item.get("value", ""))
        elif kind == "table":
            rows = [row for row in block.get("rows", []) if isinstance(row, list)]
            if rows:
                cols = max(len(row) for row in rows); table = document.add_table(rows=len(rows), cols=cols)
                for r, row in enumerate(rows):
                    for c, cell in enumerate(row): table.cell(r, c).text = str(cell)
        elif kind == "bullet_list":
            for item in block.get("items", []): document.add_paragraph(str(item), style="List Bullet")
        elif kind == "spacer": document.add_paragraph("")
        elif kind == "page_break": document.add_page_break()
        elif kind == "signature":
            paragraph = document.add_paragraph(); paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT; paragraph.add_run(str(block.get("name") or block.get("label") or "Authorised Signatory")).bold = True; paragraph.add_run("\n" + str(block.get("label", "Authorised Signatory")))
    footer_text = str(design.get("footer_text", "")).strip()
    if footer_text:
        section.footer.paragraphs[0].text = footer_text
    buffer = BytesIO(); document.save(buffer); return buffer.getvalue()


def _html(request: DocumentRenderRequest, blocks: list[dict[str, Any]]) -> bytes:
    design = request.design_schema
    parts = ["<!doctype html><html><head><meta charset='utf-8'><title>", escape(request.title), "</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:40px auto;padding:0 28px;color:#111;line-height:1.55}h1,h2,h3{line-height:1.2}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #bbb;padding:7px;text-align:left}.kv td:first-child{font-weight:700;width:32%}.signature{margin-top:52px}.footer{margin-top:44px;padding-top:12px;border-top:1px solid #ddd;color:#666;font-size:12px}.pagebreak{page-break-after:always}</style></head><body>"]
    for block in blocks:
        kind = str(block.get("type", "")).lower()
        if kind == "heading":
            level = max(1, min(int(block.get("level", 1)), 3)); parts += [f"<h{level}>", escape(str(block.get("text", ""))), f"</h{level}>"]
        elif kind == "paragraph": parts += ["<p>", escape(str(block.get("text", ""))).replace("\n", "<br>"), "</p>"]
        elif kind == "key_value":
            parts.append("<table class='kv'>");
            for item in block.get("items", []):
                if isinstance(item, dict): parts += ["<tr><td>", escape(str(item.get("label", ""))), "</td><td>", escape(str(item.get("value", ""))), "</td></tr>"]
            parts.append("</table>")
        elif kind == "table":
            parts.append("<table>")
            for index, row in enumerate(block.get("rows", [])):
                if not isinstance(row, list): continue
                tag = "th" if index == 0 and block.get("header", True) else "td"; parts.append("<tr>");
                for cell in row: parts += [f"<{tag}>", escape(str(cell)), f"</{tag}>"]
                parts.append("</tr>")
            parts.append("</table>")
        elif kind == "bullet_list": parts += ["<ul>", *[f"<li>{escape(str(item))}</li>" for item in block.get("items", [])], "</ul>"]
        elif kind == "spacer": parts.append("<div style='height:24px'></div>")
        elif kind == "page_break": parts.append("<div class='pagebreak'></div>")
        elif kind == "signature": parts += ["<div class='signature'><strong>", escape(str(block.get("name") or block.get("label") or "Authorised Signatory")), "</strong><br>", escape(str(block.get("label", "Authorised Signatory"))), "</div>"]
    footer = str(design.get("footer_text", "")).strip()
    if footer: parts += ["<div class='footer'>", escape(footer), "</div>"]
    parts.append("</body></html>")
    return "".join(parts).encode("utf-8")


def _xlsx(request: DocumentRenderRequest, blocks: list[dict[str, Any]]) -> bytes:
    workbook = Workbook(); sheet = workbook.active; sheet.title = "Document"
    row_no = 1
    for block in blocks:
        kind = str(block.get("type", "")).lower()
        if kind == "heading": sheet.cell(row_no, 1, str(block.get("text", ""))).font = sheet.cell(row_no, 1).font.copy(bold=True, size=14 if int(block.get("level", 1)) == 1 else 12); row_no += 2
        elif kind == "paragraph": sheet.cell(row_no, 1, str(block.get("text", ""))); row_no += 2
        elif kind == "key_value":
            for item in block.get("items", []):
                if isinstance(item, dict): sheet.cell(row_no, 1, str(item.get("label", ""))).font = sheet.cell(row_no, 1).font.copy(bold=True); sheet.cell(row_no, 2, str(item.get("value", ""))); row_no += 1
            row_no += 1
        elif kind == "table":
            for row in block.get("rows", []):
                if isinstance(row, list):
                    for col, cell in enumerate(row, 1): sheet.cell(row_no, col, str(cell))
                    row_no += 1
            row_no += 1
        elif kind == "bullet_list":
            for item in block.get("items", []): sheet.cell(row_no, 1, f"• {item}"); row_no += 1
            row_no += 1
        elif kind == "spacer": row_no += 1
        elif kind == "page_break": row_no += 2
        elif kind == "signature": sheet.cell(row_no, 1, str(block.get("name") or block.get("label") or "Authorised Signatory")); row_no += 2
    sheet.column_dimensions["A"].width = 34; sheet.column_dimensions["B"].width = 70
    buffer = BytesIO(); workbook.save(buffer); return buffer.getvalue()


def render_document(request: DocumentRenderRequest) -> RenderedDocument:
    blocks = compose_blocks(request)
    renderers: dict[str, Callable[[DocumentRenderRequest, list[dict[str, Any]]], bytes]] = {"PDF": _pdf, "DOCX": _docx, "HTML": _html, "XLSX": _xlsx}
    content = renderers[request.output_format](request, blocks)
    digest = sha256(content).hexdigest()
    return RenderedDocument(content=content, mime_type=_MIME[request.output_format], extension=_EXT[request.output_format], sha256=digest)


def build_document_engine_router(require_roles):
    router = APIRouter(prefix="/api/v1/document-engine", tags=["document-engine"])
    document_roles = ("OWNER", "DIRECTOR", "HR", "CS", "LEGAL", "FINANCE", "CA", "OPERATIONS", "PRODUCT_ADMIN", "MEMBER")

    @router.post("/render")
    def render_endpoint(payload: DocumentRenderRequest, _ctx=Depends(require_roles(*document_roles))):
        try:
            rendered = render_document(payload)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        filename = f"{payload.document_code}.{rendered.extension}"
        return StreamingResponse(
            BytesIO(rendered.content),
            media_type=rendered.mime_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "ETag": f'"{rendered.sha256}"',
                "X-Document-SHA256": rendered.sha256,
                "X-Document-Bytes": str(len(rendered.content)),
                "Cache-Control": "no-store",
            },
        )

    return router
