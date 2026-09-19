import pytest

from backend.file_security import MalwareScannerUnavailable, _parse_clamav_response


def test_clamav_clean_response():
    result = _parse_clamav_response(b"stream: OK\x00")
    assert result.clean is True
    assert result.signature is None
    assert result.raw_status == "OK"


def test_clamav_found_response():
    result = _parse_clamav_response(b"stream: Eicar-Test-Signature FOUND\x00")
    assert result.clean is False
    assert result.signature == "Eicar-Test-Signature"
    assert result.raw_status == "FOUND"


def test_clamav_error_fails_closed():
    with pytest.raises(MalwareScannerUnavailable):
        _parse_clamav_response(b"stream: temporary scanner failure ERROR\x00")


def test_clamav_unknown_response_fails_closed():
    with pytest.raises(MalwareScannerUnavailable):
        _parse_clamav_response(b"unexpected scanner response\x00")
