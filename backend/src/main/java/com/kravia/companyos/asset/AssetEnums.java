package com.kravia.companyos.asset;

public final class AssetEnums {
    private AssetEnums() {}

    public enum AssetCategory {
        LAPTOP,
        MOBILE,
        SERVER,
        CLOUD_RESOURCE,
        SOFTWARE_LICENSE,
        DOMAIN,
        SSL_CERTIFICATE,
        OFFICE_EQUIPMENT,
        FURNITURE,
        NETWORK_DEVICE,
        OTHER
    }

    public enum AssetStatus {
        ACTIVE,
        ASSIGNED,
        UNASSIGNED,
        UNDER_MAINTENANCE,
        EXPIRED,
        LOST,
        SOLD,
        RETIRED,
        ARCHIVED
    }

    public enum AssetReportType {
        ASSET_REGISTER,
        ASSIGNMENTS,
        MAINTENANCE,
        SOFTWARE_LICENSES,
        CLOUD_RESOURCES,
        DEPRECIATION,
        WARRANTY_EXPIRY,
        DOCUMENT_LINKS
    }
}