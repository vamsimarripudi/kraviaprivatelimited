package com.kravia.companyos.dashboard;

import com.kravia.companyos.audit.AuditLogRepository;
import com.kravia.companyos.compliance.ComplianceItemRepository;
import com.kravia.companyos.contact.ContactRecordRepository;
import com.kravia.companyos.document.DocumentRepository;
import com.kravia.companyos.finance.FinancialRecordRepository;
import com.kravia.companyos.meeting.BoardMeetingRepository;
import com.kravia.companyos.product.ProductRecordRepository;
import com.kravia.companyos.task.CompanyTaskRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/dashboard")
public class DashboardController {
    private final DocumentRepository documents;
    private final BoardMeetingRepository meetings;
    private final FinancialRecordRepository financials;
    private final ComplianceItemRepository compliance;
    private final CompanyTaskRepository tasks;
    private final ProductRecordRepository products;
    private final ContactRecordRepository contacts;
    private final AuditLogRepository audit;

    public DashboardController(DocumentRepository documents, BoardMeetingRepository meetings, FinancialRecordRepository financials, ComplianceItemRepository compliance, CompanyTaskRepository tasks, ProductRecordRepository products, ContactRecordRepository contacts, AuditLogRepository audit) {
        this.documents = documents;
        this.meetings = meetings;
        this.financials = financials;
        this.compliance = compliance;
        this.tasks = tasks;
        this.products = products;
        this.contacts = contacts;
        this.audit = audit;
    }

    @GetMapping("/summary")
    public DashboardSummary summary() {
        return new DashboardSummary(documents.count(), meetings.count(), financials.count(), compliance.count(), tasks.count(), products.count(), contacts.count(), audit.count());
    }
}
