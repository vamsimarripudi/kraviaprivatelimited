package com.kravia.companyos.report;

import java.time.Instant;
import java.util.List;

public record ReportResponse(
    String key,
    String title,
    String description,
    Instant generatedAt,
    ReportFilters filters,
    List<ReportMetric> metrics,
    List<ReportSection> sections,
    boolean pdfExportAvailable,
    boolean excelExportAvailable
) {}
