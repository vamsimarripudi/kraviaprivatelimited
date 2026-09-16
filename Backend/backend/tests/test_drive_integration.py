from backend.drive_integration import GoogleDriveAdapter, build_evidence_readiness


def test_drive_readiness_is_fail_closed(monkeypatch):
    monkeypatch.delenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", raising=False)
    monkeypatch.delenv("GOOGLE_DRIVE_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", raising=False)
    readiness = GoogleDriveAdapter().readiness()
    assert readiness["configured"] is False
    assert readiness["write_enabled"] is False
    assert readiness["content_download_enabled"] is False
    assert "03 - Finance & Accounting" in readiness["expected_evidence_areas"]


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


def test_evidence_readiness_distinguishes_empty_missing_and_misfiled():
    folder_mime = "application/vnd.google-apps.folder"
    items = [
        {"name": "00 - Company Master", "path": "00 - Company Master", "is_folder": True, "mime_type": folder_mime},
        {"name": "Company.pdf", "path": "00 - Company Master/Company.pdf", "is_folder": False, "mime_type": "application/pdf"},
        {"name": "01 - Governance", "path": "01 - Governance", "is_folder": True, "mime_type": folder_mime},
        {"name": "Authority.pdf", "path": "01 - Governance/Authority.pdf", "is_folder": False, "mime_type": "application/pdf"},
        {"name": "02 - Compliance", "path": "02 - Compliance", "is_folder": True, "mime_type": folder_mime},
        {"name": "03 - Finance & Accounting", "path": "03 - Finance & Accounting", "is_folder": True, "mime_type": folder_mime},
        {"name": "04 - GST & Tax", "path": "04 - GST & Tax", "is_folder": True, "mime_type": folder_mime},
        {"name": "GST.pdf", "path": "04 - GST & Tax/GST.pdf", "is_folder": False, "mime_type": "application/pdf"},
        {"name": "05 - Banking & Payments", "path": "05 - Banking & Payments", "is_folder": True, "mime_type": folder_mime},
        {"name": "06 - Customers & Contracts", "path": "06 - Customers & Contracts", "is_folder": True, "mime_type": folder_mime},
        {"name": "Shareholders Agreement.docx", "path": "06 - Customers & Contracts/Shareholders Agreement.docx", "is_folder": False, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
        {"name": "07 - Vendors & Procurement", "path": "07 - Vendors & Procurement", "is_folder": True, "mime_type": folder_mime},
        {"name": "08 - People & HR", "path": "08 - People & HR", "is_folder": True, "mime_type": folder_mime},
    ]
    result = build_evidence_readiness(items)
    by_area = {row["area"]: row["state"] for row in result["areas"]}
    assert by_area["00 - Company Master"] == "AVAILABLE"
    assert by_area["03 - Finance & Accounting"] == "EMPTY"
    assert result["missing_areas"] == 0
    assert result["readiness"] == "READY_WITH_GAPS"
    assert result["warnings"][0]["code"] == "OWNERSHIP_EVIDENCE_MISFILED"
    assert result["content_downloaded"] is False
