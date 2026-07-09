package com.kravia.companyos.report;

import java.util.List;
import java.util.Map;

public record ReportSection(String title, List<String> columns, List<Map<String, String>> rows) {}
