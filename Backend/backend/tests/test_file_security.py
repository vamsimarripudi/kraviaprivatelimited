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


def test_clamav_stream_detects_threat(monkeypatch):
    fake = _FakeSocket(b"stream: Eicar-Signature FOUND\0")
    monkeypatch.setenv("CLAMAV_HOST", "clamav.internal")
    monkeypatch.setattr(file_security.socket, "create_connection", lambda *_a, **_k: fake)
    result = file_security.scan_bytes(b"test payload")
    assert result["clean"] is False
    assert result["threat"] == "Eicar-Signature"
