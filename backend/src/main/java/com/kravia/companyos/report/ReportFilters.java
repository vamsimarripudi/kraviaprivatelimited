package com.kravia.companyos.report;

import java.time.LocalDate;

public record ReportFilters(LocalDate from, LocalDate to, String module) {}
