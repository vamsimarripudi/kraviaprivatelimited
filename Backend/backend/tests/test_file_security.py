import io
import os
import zipfile

import pytest
from fastapi import HTTPException

from backend import file_security


def _zip_with(*names: str) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        for name in names:
            archive.writestr(name, "<x/>")
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("payload", "expected"),
    [
        (b"%PDF-1.7\n%%EOF", "application/pdf"),
        (b"\xff\xd8\xff\xe0jpeg", "image/jpeg"),
        (b"\x89PNG\r\n\x1a\npng", "image/png"),
        (b"RIFF\x08\x00\x00\x00WEBPdata", "image/webp"),
    ],
)
def test_detect_mime_common_types(payload, expected):
    assert file_security.detect_mime(payload) == expected


def test_detect_mime_office_open_xml():
    assert file_security.detect_mime(_zip_with("word/document.xml")) == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert file_security.detect_mime(_zip_with("xl/workbook.xml")) == (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


def test_validate_rejects_extension_mismatch():
    with pytest.raises(HTTPException) as exc:
        file_security._validate_file(
            purpose="CORPORATE",
            filename="invoice.jpg",
            declared_mime="application/pdf",
            data=b"%PDF-1.7\n%%EOF",
        )
    assert exc.value.status_code == 415


def test_file_security_readiness_requires_storage_and_scanner(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_AUTH_URL", raising=False)
    monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY", raising=False)
    monkeypatch.delenv("KRAVIA_STORAGE_BROKER_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("KRAVIA_STORAGE_BROKER_URL", raising=False)
    monkeypatch.delenv("CLAMAV_HOST", raising=False)
    assert file_security.file_security_ready() is False

    monkeypatch.setenv("SUPABASE_AUTH_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    monkeypatch.setenv("KRAVIA_STORAGE_BROKER_PRIVATE_KEY", "test-key-present")
    monkeypatch.setenv("CLAMAV_HOST", "clamav.railway.internal")
    assert file_security.file_security_ready() is True


class _FakeSocket:
    def __init__(self, response: bytes):
        self.response = response
        self.sent = bytearray()
        self._read = False

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def settimeout(self, _timeout):
        return None

    def sendall(self, data: bytes):
        self.sent.extend(data)

    def recv(self, _size: int) -> bytes:
        if self._read:
            return b""
        self._read = True
        return self.response


def test_clamav_stream_clean(monkeypatch):
    fake = _FakeSocket(b"stream: OK\0")
    monkeypatch.setenv("CLAMAV_HOST", "clamav.internal")
    monkeypatch.setattr(file_security.socket, "create_connection", lambda *_a, **_k: fake)
    result = file_security.scan_bytes(b"safe payload")
    assert result["clean"] is True
    assert fake.sent.startswith(b"zINSTREAM\0")


def test_clamav_eicar_self_test_passes_only_when_eicar_is_detected(monkeypatch):
    monkeypatch.setattr(file_security, "clamav_version", lambda: "ClamAV 1.5.4")
    monkeypatch.setattr(
        file_security,
        "scan_bytes",
        lambda payload: {
            "clean": False,
            "threat": "Win.Test.EICAR_HDB-1",
            "response": "stream: Win.Test.EICAR_HDB-1 FOUND",
        },
    )
    result = file_security.clamav_eicar_self_test()
    assert result["status"] == "PASSED"
    assert result["scanner"] == "CLAMAV"
    assert "EICAR" in result["threat"]
    assert len(file_security.EICAR_TEST_BYTES) == 68


def test_clamav_eicar_self_test_fails_closed_when_scanner_returns_clean(monkeypatch):
    monkeypatch.setattr(file_security, "clamav_version", lambda: "ClamAV 1.5.4")
    monkeypatch.setattr(
        file_security,
        "scan_bytes",
        lambda _payload: {"clean": True, "threat": None, "response": "stream: OK"},
    )
    with pytest.raises(RuntimeError, match="CLAMAV_EICAR_NOT_DETECTED"):
        file_security.clamav_eicar_self_test()


def test_clamav_stream_detects_threat(monkeypatch):
    fake = _FakeSocket(b"stream: Eicar-Signature FOUND\0")
    monkeypatch.setenv("CLAMAV_HOST", "clamav.internal")
    monkeypatch.setattr(file_security.socket, "create_connection", lambda *_a, **_k: fake)
    result = file_security.scan_bytes(b"test payload")
    assert result["clean"] is False
    assert result["threat"] == "Eicar-Signature"


class _ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one(self):
        return self.value


class _FinalizeDb:
    def __init__(self):
        self.calls = []

    def execute(self, statement, params=None):
        self.calls.append((str(statement), params or {}))
        return _ScalarResult("44444444-4444-4444-8444-444444444444")


def test_non_signature_clean_context_needs_no_document_finalization():
    db = _FinalizeDb()
    result = file_security._finalize_clean_context(
        db,
        {"context_type": "CANDIDATE_PROFILE"},
        "scanned/2026/09/file/document.pdf",
    )
    assert result is None
    assert db.calls == []


def test_clean_signed_document_context_finalizes_canonical_signature(monkeypatch):
    db = _FinalizeDb()
    events = []
    monkeypatch.setattr(
        file_security,
        "_event",
        lambda _db, file_id, event_type, **kwargs: events.append(
            (file_id, event_type, kwargs)
        ),
    )
    row = {
        "id": "55555555-5555-4555-8555-555555555555",
        "owner_user_id": "11111111-1111-4111-8111-111111111111",
        "context_type": "DOCUMENT_SIGNATURE",
        "context_id": "22222222-2222-4222-8222-222222222222",
        "context_metadata": {
            "instance_id": "22222222-2222-4222-8222-222222222222",
            "render_id": "33333333-3333-4333-8333-333333333333",
            "provider": "MANUAL",
            "provider_reference": "verified-ref",
            "signature_method": "DSC",
            "signer_reference_masked": "Director ending 1234",
            "signed_at": "2026-09-21T02:00:00+00:00",
            "evidence": {"source": "verified signed PDF"},
        },
        "sha256": "a" * 64,
        "byte_size": 1234,
    }

    result = file_security._finalize_clean_context(
        db,
        row,
        "scanned/2026/09/file/signed.pdf",
    )

    assert result == {
        "signature_evidence_id": "44444444-4444-4444-8444-444444444444"
    }
    sql, params = db.calls[0]
    assert "office_document_record_signature" in sql
    assert params["actor"] == row["owner_user_id"]
    assert params["instance"] == row["context_metadata"]["instance_id"]
    assert params["render"] == row["context_metadata"]["render_id"]
    assert params["storage"] == "scanned/2026/09/file/signed.pdf"
    assert params["sha"] == "a" * 64
    assert events[0][1] == "WORKFLOW_CONTEXT_FINALIZED"


def test_signed_document_context_rejects_incomplete_metadata():
    db = _FinalizeDb()
    with pytest.raises(RuntimeError, match="SIGNATURE_CONTEXT_INCOMPLETE"):
        file_security._finalize_clean_context(
            db,
            {
                "context_type": "DOCUMENT_SIGNATURE",
                "context_metadata": {"provider": "MANUAL"},
            },
            "scanned/2026/09/file/signed.pdf",
        )
