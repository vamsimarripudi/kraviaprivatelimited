from backend.drive_integration import GoogleDriveAdapter


def test_drive_readiness_is_fail_closed(monkeypatch):
    monkeypatch.delenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", raising=False)
    monkeypatch.delenv("GOOGLE_DRIVE_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", raising=False)
    readiness = GoogleDriveAdapter().readiness()
    assert readiness["configured"] is False
    assert readiness["write_enabled"] is False
    assert readiness["content_download_enabled"] is False


def test_drive_discovery_is_bounded_and_metadata_only(monkeypatch):
    monkeypatch.setenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "root")
    monkeypatch.setenv("GOOGLE_DRIVE_ACCESS_TOKEN", "test-token")
    adapter = GoogleDriveAdapter()
    data = {
        "root": [
            {"id": "folder-a", "name": "01 - Governance", "mimeType": "application/vnd.google-apps.folder"},
            {"id": "file-a", "name": "Resolution.pdf", "mimeType": "application/pdf", "size": "100", "md5Checksum": "abc"},
        ],
        "folder-a": [
            {"id": "file-b", "name": "Minutes.pdf", "mimeType": "application/pdf", "size": "200", "md5Checksum": "def"}
        ],
    }
    monkeypatch.setattr(adapter, "list_children", lambda folder_id: data.get(folder_id, []))
    rows = adapter.discover(max_depth=2, max_items=10)
    assert [row["path"] for row in rows] == ["01 - Governance", "Resolution.pdf", "01 - Governance/Minutes.pdf"]
    assert all("content" not in row for row in rows)
    assert rows[1]["md5_checksum"] == "abc"
