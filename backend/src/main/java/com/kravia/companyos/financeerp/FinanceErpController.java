package com.kravia.companyos.financeerp;

import com.kravia.companyos.financeerp.FinanceErpDto.AccountRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.AccountResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.ApprovalRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.ApprovalResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.BankAccountRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.BankAccountResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.BankTransactionRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.BankTransactionResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.BudgetRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.BudgetResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.FinanceDashboardResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.FinanceReportResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.GstRecordRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.GstRecordResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.InvoiceRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.InvoiceResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.JournalEntryRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.JournalEntryResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.PayableRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.PayableResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.ReceivableRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.ReceivableResponse;
import com.kravia.companyos.financeerp.FinanceErpEnums.AccountType;
import com.kravia.companyos.financeerp.FinanceErpEnums.BudgetStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinanceReportType;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinancialApprovalStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.GstFilingStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.InvoiceStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.JournalApprovalStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.PaymentStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.ReceivableStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.ReconciliationStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.RecordStatus;
import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/finance-erp")
public class FinanceErpController {
    private final FinanceErpService service;

    public FinanceErpController(FinanceErpService service) { this.service = service; }

    @GetMapping("/dashboard")
    public FinanceDashboardResponse dashboard(@AuthenticationPrincipal AppUser actor) {
        return service.dashboard(actor);
    }

    @GetMapping("/accounts")
    public List<AccountResponse> accounts(@RequestParam(required = false) String query, @RequestParam(required = false) AccountType type, @RequestParam(required = false) RecordStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listAccounts(query, type, status, actor);
    }

    @PostMapping("/accounts")
    public AccountResponse createAccount(@Valid @RequestBody AccountRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createAccount(request, actor);
    }

    @PutMapping("/accounts/{id}")
    public AccountResponse updateAccount(@PathVariable UUID id, @Valid @RequestBody AccountRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateAccount(id, request, actor);
    }

    @DeleteMapping("/accounts/{id}")
    public void archiveAccount(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveAccount(id, actor);
    }

    @GetMapping("/journal-entries")
    public List<JournalEntryResponse> journalEntries(@RequestParam(required = false) String query, @RequestParam(required = false) JournalApprovalStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listJournalEntries(query, status, actor);
    }

    @PostMapping("/journal-entries")
    public JournalEntryResponse createJournalEntry(@Valid @RequestBody JournalEntryRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createJournalEntry(request, actor);
    }

    @PutMapping("/journal-entries/{id}")
    public JournalEntryResponse updateJournalEntry(@PathVariable UUID id, @Valid @RequestBody JournalEntryRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateJournalEntry(id, request, actor);
    }

    @DeleteMapping("/journal-entries/{id}")
    public void archiveJournalEntry(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveJournalEntry(id, actor);
    }

    @GetMapping("/bank-accounts")
    public List<BankAccountResponse> bankAccounts(@RequestParam(required = false) String query, @AuthenticationPrincipal AppUser actor) {
        return service.listBankAccounts(query, actor);
    }

    @PostMapping("/bank-accounts")
    public BankAccountResponse createBankAccount(@Valid @RequestBody BankAccountRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createBankAccount(request, actor);
    }

    @PutMapping("/bank-accounts/{id}")
    public BankAccountResponse updateBankAccount(@PathVariable UUID id, @Valid @RequestBody BankAccountRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateBankAccount(id, request, actor);
    }

    @DeleteMapping("/bank-accounts/{id}")
    public void archiveBankAccount(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveBankAccount(id, actor);
    }

    @GetMapping("/bank-transactions")
    public List<BankTransactionResponse> bankTransactions(@RequestParam(required = false) String query, @RequestParam(required = false) ReconciliationStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listBankTransactions(query, status, actor);
    }

    @PostMapping("/bank-transactions")
    public BankTransactionResponse createBankTransaction(@Valid @RequestBody BankTransactionRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createBankTransaction(request, actor);
    }

    @PutMapping("/bank-transactions/{id}")
    public BankTransactionResponse updateBankTransaction(@PathVariable UUID id, @Valid @RequestBody BankTransactionRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateBankTransaction(id, request, actor);
    }

    @DeleteMapping("/bank-transactions/{id}")
    public void archiveBankTransaction(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveBankTransaction(id, actor);
    }

    @GetMapping("/invoices")
    public List<InvoiceResponse> invoices(@RequestParam(required = false) String query, @RequestParam(required = false) InvoiceStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listInvoices(query, status, actor);
    }

    @PostMapping("/invoices")
    public InvoiceResponse createInvoice(@Valid @RequestBody InvoiceRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createInvoice(request, actor);
    }

    @PutMapping("/invoices/{id}")
    public InvoiceResponse updateInvoice(@PathVariable UUID id, @Valid @RequestBody InvoiceRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateInvoice(id, request, actor);
    }

    @DeleteMapping("/invoices/{id}")
    public void archiveInvoice(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveInvoice(id, actor);
    }

    @GetMapping("/receivables")
    public List<ReceivableResponse> receivables(@RequestParam(required = false) String query, @RequestParam(required = false) ReceivableStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listReceivables(query, status, actor);
    }

    @PostMapping("/receivables")
    public ReceivableResponse createReceivable(@Valid @RequestBody ReceivableRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createReceivable(request, actor);
    }

    @PutMapping("/receivables/{id}")
    public ReceivableResponse updateReceivable(@PathVariable UUID id, @Valid @RequestBody ReceivableRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateReceivable(id, request, actor);
    }

    @DeleteMapping("/receivables/{id}")
    public void archiveReceivable(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveReceivable(id, actor);
    }

    @GetMapping("/payables")
    public List<PayableResponse> payables(@RequestParam(required = false) String query, @RequestParam(required = false) PaymentStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listPayables(query, status, actor);
    }

    @PostMapping("/payables")
    public PayableResponse createPayable(@Valid @RequestBody PayableRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createPayable(request, actor);
    }

    @PutMapping("/payables/{id}")
    public PayableResponse updatePayable(@PathVariable UUID id, @Valid @RequestBody PayableRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updatePayable(id, request, actor);
    }

    @DeleteMapping("/payables/{id}")
    public void archivePayable(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archivePayable(id, actor);
    }

    @GetMapping("/gst-records")
    public List<GstRecordResponse> gstRecords(@RequestParam(required = false) String query, @RequestParam(required = false) GstFilingStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listGstRecords(query, status, actor);
    }

    @PostMapping("/gst-records")
    public GstRecordResponse createGstRecord(@Valid @RequestBody GstRecordRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createGstRecord(request, actor);
    }

    @PutMapping("/gst-records/{id}")
    public GstRecordResponse updateGstRecord(@PathVariable UUID id, @Valid @RequestBody GstRecordRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateGstRecord(id, request, actor);
    }

    @DeleteMapping("/gst-records/{id}")
    public void archiveGstRecord(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveGstRecord(id, actor);
    }

    @GetMapping("/budgets")
    public List<BudgetResponse> budgets(@RequestParam(required = false) String query, @RequestParam(required = false) BudgetStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listBudgets(query, status, actor);
    }

    @PostMapping("/budgets")
    public BudgetResponse createBudget(@Valid @RequestBody BudgetRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createBudget(request, actor);
    }

    @PutMapping("/budgets/{id}")
    public BudgetResponse updateBudget(@PathVariable UUID id, @Valid @RequestBody BudgetRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateBudget(id, request, actor);
    }

    @DeleteMapping("/budgets/{id}")
    public void archiveBudget(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveBudget(id, actor);
    }

    @GetMapping("/approvals")
    public List<ApprovalResponse> approvals(@RequestParam(required = false) String query, @RequestParam(required = false) FinancialApprovalStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listApprovals(query, status, actor);
    }

    @PostMapping("/approvals")
    public ApprovalResponse createApproval(@Valid @RequestBody ApprovalRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createApproval(request, actor);
    }

    @PutMapping("/approvals/{id}")
    public ApprovalResponse updateApproval(@PathVariable UUID id, @Valid @RequestBody ApprovalRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateApproval(id, request, actor);
    }

    @DeleteMapping("/approvals/{id}")
    public void archiveApproval(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveApproval(id, actor);
    }

    @GetMapping("/reports/{type}")
    public FinanceReportResponse report(@PathVariable FinanceReportType type, @AuthenticationPrincipal AppUser actor) {
        return service.report(type, actor);
    }
}
