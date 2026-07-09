package com.kravia.companyos.procurement;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.financeerp.FinanceErpEnums.PaymentStatus;
import com.kravia.companyos.financeerp.VendorPayable;
import com.kravia.companyos.financeerp.VendorPayableRepository;
import com.kravia.companyos.procurement.ProcurementDto.ProcurementApprovalPayload;
import com.kravia.companyos.procurement.ProcurementDto.ProcurementApprovalResponse;
import com.kravia.companyos.procurement.ProcurementDto.ProcurementMetric;
import com.kravia.companyos.procurement.ProcurementDto.ProcurementReportResponse;
import com.kravia.companyos.procurement.ProcurementDto.ProcurementSummaryResponse;
import com.kravia.companyos.procurement.ProcurementDto.PurchaseOrderPayload;
import com.kravia.companyos.procurement.ProcurementDto.PurchaseOrderResponse;
import com.kravia.companyos.procurement.ProcurementDto.PurchaseRequestPayload;
import com.kravia.companyos.procurement.ProcurementDto.PurchaseRequestResponse;
import com.kravia.companyos.procurement.ProcurementDto.SubscriptionPayload;
import com.kravia.companyos.procurement.ProcurementDto.SubscriptionResponse;
import com.kravia.companyos.procurement.ProcurementDto.VendorBillPayload;
import com.kravia.companyos.procurement.ProcurementDto.VendorBillResponse;
import com.kravia.companyos.procurement.ProcurementDto.VendorDocumentPayload;
import com.kravia.companyos.procurement.ProcurementDto.VendorDocumentResponse;
import com.kravia.companyos.procurement.ProcurementDto.VendorRequest;
import com.kravia.companyos.procurement.ProcurementDto.VendorResponse;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementPriority;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementReportType;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import com.kravia.companyos.procurement.ProcurementEnums.VendorCategory;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProcurementService {
    private static final String MODULE = "PROCUREMENT";
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final ProcurementVendorRepository vendors;
    private final PurchaseRequestRepository purchaseRequests;
    private final PurchaseOrderRepository purchaseOrders;
    private final VendorBillRepository vendorBills;
    private final ProcurementSubscriptionRepository subscriptions;
    private final ProcurementApprovalRepository approvals;
    private final VendorDocumentRepository vendorDocuments;
    private final VendorPayableRepository financePayables;
    private final PermissionService permissions;
    private final AuditService auditService;

    public ProcurementService(
        ProcurementVendorRepository vendors,
        PurchaseRequestRepository purchaseRequests,
        PurchaseOrderRepository purchaseOrders,
        VendorBillRepository vendorBills,
        ProcurementSubscriptionRepository subscriptions,
        ProcurementApprovalRepository approvals,
        VendorDocumentRepository vendorDocuments,
        VendorPayableRepository financePayables,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.vendors = vendors;
        this.purchaseRequests = purchaseRequests;
        this.purchaseOrders = purchaseOrders;
        this.vendorBills = vendorBills;
        this.subscriptions = subscriptions;
        this.approvals = approvals;
        this.vendorDocuments = vendorDocuments;
        this.financePayables = financePayables;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public ProcurementSummaryResponse summary(AppUser actor) {
        requireViewer(actor);
        LocalDate today = LocalDate.now();
        LocalDate nextMonth = today.plusDays(30);
        long activeVendors = vendors.findAll().stream().filter(vendor -> active(vendor.getStatus(), vendor.getArchivedAt())).count();
        long pendingRequests = purchaseRequests.findAll().stream().filter(request -> request.getArchivedAt() == null && request.getApprovalStatus() == ProcurementStatus.PENDING_APPROVAL).count();
        long approvedOrders = purchaseOrders.findAll().stream().filter(order -> order.getArchivedAt() == null && order.getStatus() == ProcurementStatus.APPROVED).count();
        long unpaidBills = vendorBills.findAll().stream().filter(this::unpaidBill).count();
        long renewals = subscriptions.findAll().stream().filter(subscription -> subscription.getArchivedAt() == null && subscription.getRenewalDate() != null && !subscription.getRenewalDate().isBefore(today) && !subscription.getRenewalDate().isAfter(nextMonth)).count();
        long overduePayments = vendorBills.findAll().stream().filter(bill -> unpaidBill(bill) && bill.getDueDate().isBefore(today)).count();
        List<ProcurementMetric> metrics = List.of(
            new ProcurementMetric("Active vendors", activeVendors, "neutral"),
            new ProcurementMetric("Pending purchase requests", pendingRequests, pendingRequests == 0 ? "positive" : "warning"),
            new ProcurementMetric("Approved purchase orders", approvedOrders, "neutral"),
            new ProcurementMetric("Unpaid vendor bills", unpaidBills, unpaidBills == 0 ? "positive" : "warning"),
            new ProcurementMetric("Upcoming subscription renewals", renewals, renewals == 0 ? "positive" : "warning"),
            new ProcurementMetric("Overdue payments", overduePayments, overduePayments == 0 ? "positive" : "negative")
        );
        return new ProcurementSummaryResponse(activeVendors, pendingRequests, approvedOrders, unpaidBills, renewals, overduePayments, metrics);
    }

    @Transactional(readOnly = true)
    public List<VendorResponse> listVendors(String query, VendorCategory category, ProcurementStatus status, AppUser actor) {
        requireViewer(actor);
        return vendors.findAllByOrderByVendorNameAsc().stream()
            .filter(vendor -> category == null || vendor.getCategory() == category)
            .filter(vendor -> status == null || vendor.getStatus() == status)
            .filter(vendor -> matches(query, vendor.getVendorName(), vendor.getContactPerson(), vendor.getEmail(), vendor.getServiceType(), vendor.getNotes()))
            .map(VendorResponse::from)
            .toList();
    }

    @Transactional
    public VendorResponse createVendor(VendorRequest request, AppUser actor) {
        requireEditor(actor);
        ProcurementVendor vendor = new ProcurementVendor();
        vendor.setCreatedBy(actor.getDisplayName());
        applyVendor(vendor, request);
        ProcurementVendor saved = vendors.saveAndFlush(vendor);
        audit(actor, "VENDOR_CREATED", "Created vendor " + saved.getVendorName(), "IMPORTANT");
        return VendorResponse.from(saved);
    }

    @Transactional
    public VendorResponse updateVendor(UUID id, VendorRequest request, AppUser actor) {
        requireEditor(actor);
        ProcurementVendor vendor = findVendor(id);
        applyVendor(vendor, request);
        markArchived(vendor.getStatus(), vendor::setArchivedAt);
        ProcurementVendor saved = vendors.saveAndFlush(vendor);
        audit(actor, "VENDOR_UPDATED", "Updated vendor " + saved.getVendorName(), "IMPORTANT");
        return VendorResponse.from(saved);
    }

    @Transactional
    public void archiveVendor(UUID id, AppUser actor) {
        requireFounder(actor);
        ProcurementVendor vendor = findVendor(id);
        vendor.setStatus(ProcurementStatus.ARCHIVED);
        vendor.setArchivedAt(Instant.now());
        audit(actor, "VENDOR_ARCHIVED", "Archived vendor " + vendor.getVendorName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<PurchaseRequestResponse> listPurchaseRequests(String query, ProcurementStatus status, ProcurementStatus approvalStatus, AppUser actor) {
        requireViewer(actor);
        return purchaseRequests.findAllByOrderByRequiredDateAscCreatedAtDesc().stream()
            .filter(request -> status == null || request.getStatus() == status)
            .filter(request -> approvalStatus == null || request.getApprovalStatus() == approvalStatus)
            .filter(request -> matches(query, request.getRequestTitle(), request.getPurpose(), request.getRequestedBy(), vendorName(request.getVendor())))
            .map(PurchaseRequestResponse::from)
            .toList();
    }

    @Transactional
    public PurchaseRequestResponse createPurchaseRequest(PurchaseRequestPayload request, AppUser actor) {
        requireEditor(actor);
        PurchaseRequest record = new PurchaseRequest();
        record.setRequestedBy(actor.getDisplayName());
        applyPurchaseRequest(record, request);
        PurchaseRequest saved = purchaseRequests.saveAndFlush(record);
        audit(actor, "PURCHASE_REQUEST_CREATED", "Created purchase request " + saved.getRequestTitle(), "IMPORTANT");
        auditApprovalStatus(actor, "PURCHASE_REQUEST", saved.getRequestTitle(), null, saved.getApprovalStatus());
        return PurchaseRequestResponse.from(saved);
    }

    @Transactional
    public PurchaseRequestResponse updatePurchaseRequest(UUID id, PurchaseRequestPayload request, AppUser actor) {
        requireEditor(actor);
        PurchaseRequest record = findPurchaseRequest(id);
        ProcurementStatus previousApproval = record.getApprovalStatus();
        applyPurchaseRequest(record, request);
        markArchived(record.getStatus(), record::setArchivedAt);
        PurchaseRequest saved = purchaseRequests.saveAndFlush(record);
        audit(actor, "PURCHASE_REQUEST_UPDATED", "Updated purchase request " + saved.getRequestTitle(), "IMPORTANT");
        auditApprovalStatus(actor, "PURCHASE_REQUEST", saved.getRequestTitle(), previousApproval, saved.getApprovalStatus());
        return PurchaseRequestResponse.from(saved);
    }

    @Transactional
    public void archivePurchaseRequest(UUID id, AppUser actor) {
        requireFounder(actor);
        PurchaseRequest request = findPurchaseRequest(id);
        request.setStatus(ProcurementStatus.ARCHIVED);
        request.setArchivedAt(Instant.now());
        audit(actor, "PURCHASE_REQUEST_ARCHIVED", "Archived purchase request " + request.getRequestTitle(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderResponse> listPurchaseOrders(String query, ProcurementStatus status, AppUser actor) {
        requireViewer(actor);
        return purchaseOrders.findAllByOrderByIssueDateDescCreatedAtDesc().stream()
            .filter(order -> status == null || order.getStatus() == status)
            .filter(order -> matches(query, order.getPoNumber(), order.getItemsServices(), vendorName(order.getVendor())))
            .map(PurchaseOrderResponse::from)
            .toList();
    }

    @Transactional
    public PurchaseOrderResponse createPurchaseOrder(PurchaseOrderPayload request, AppUser actor) {
        requireEditor(actor);
        validatePoNumber(request.poNumber(), null);
        PurchaseOrder order = new PurchaseOrder();
        order.setCreatedBy(actor.getDisplayName());
        applyPurchaseOrder(order, request);
        PurchaseOrder saved = purchaseOrders.saveAndFlush(order);
        audit(actor, "PURCHASE_ORDER_CREATED", "Created purchase order " + saved.getPoNumber(), "IMPORTANT");
        return PurchaseOrderResponse.from(saved);
    }

    @Transactional
    public PurchaseOrderResponse updatePurchaseOrder(UUID id, PurchaseOrderPayload request, AppUser actor) {
        requireEditor(actor);
        PurchaseOrder order = findPurchaseOrder(id);
        validatePoNumber(request.poNumber(), order);
        ProcurementStatus previousStatus = order.getStatus();
        applyPurchaseOrder(order, request);
        markArchived(order.getStatus(), order::setArchivedAt);
        PurchaseOrder saved = purchaseOrders.saveAndFlush(order);
        audit(actor, "PURCHASE_ORDER_UPDATED", "Updated purchase order " + saved.getPoNumber(), "IMPORTANT");
        auditApprovalStatus(actor, "PURCHASE_ORDER", saved.getPoNumber(), previousStatus, saved.getStatus());
        return PurchaseOrderResponse.from(saved);
    }

    @Transactional
    public void archivePurchaseOrder(UUID id, AppUser actor) {
        requireFounder(actor);
        PurchaseOrder order = findPurchaseOrder(id);
        order.setStatus(ProcurementStatus.ARCHIVED);
        order.setArchivedAt(Instant.now());
        audit(actor, "PURCHASE_ORDER_ARCHIVED", "Archived purchase order " + order.getPoNumber(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<VendorBillResponse> listVendorBills(String query, ProcurementStatus paymentStatus, AppUser actor) {
        requireViewer(actor);
        return vendorBills.findAllByOrderByDueDateAscCreatedAtDesc().stream()
            .filter(bill -> paymentStatus == null || bill.getPaymentStatus() == paymentStatus)
            .filter(bill -> matches(query, bill.getBillNumber(), vendorName(bill.getVendor()), bill.getPurchaseOrder() == null ? null : bill.getPurchaseOrder().getPoNumber()))
            .map(VendorBillResponse::from)
            .toList();
    }

    @Transactional
    public VendorBillResponse createVendorBill(VendorBillPayload request, AppUser actor) {
        requireEditor(actor);
        VendorBill bill = new VendorBill();
        bill.setCreatedBy(actor.getDisplayName());
        applyVendorBill(bill, request, actor);
        VendorBill saved = vendorBills.saveAndFlush(bill);
        audit(actor, "VENDOR_BILL_CREATED", "Created vendor bill " + saved.getBillNumber(), "IMPORTANT");
        return VendorBillResponse.from(saved);
    }

    @Transactional
    public VendorBillResponse updateVendorBill(UUID id, VendorBillPayload request, AppUser actor) {
        requireEditor(actor);
        VendorBill bill = findVendorBill(id);
        ProcurementStatus previousStatus = bill.getPaymentStatus();
        applyVendorBill(bill, request, actor);
        markArchived(bill.getPaymentStatus(), bill::setArchivedAt);
        VendorBill saved = vendorBills.saveAndFlush(bill);
        audit(actor, "VENDOR_BILL_UPDATED", "Updated vendor bill " + saved.getBillNumber(), "IMPORTANT");
        auditApprovalStatus(actor, "VENDOR_BILL_PAYMENT", saved.getBillNumber(), previousStatus, saved.getPaymentStatus());
        return VendorBillResponse.from(saved);
    }

    @Transactional
    public void archiveVendorBill(UUID id, AppUser actor) {
        requireFounder(actor);
        VendorBill bill = findVendorBill(id);
        bill.setPaymentStatus(ProcurementStatus.ARCHIVED);
        bill.setArchivedAt(Instant.now());
        audit(actor, "VENDOR_BILL_ARCHIVED", "Archived vendor bill " + bill.getBillNumber(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<SubscriptionResponse> listSubscriptions(String query, ProcurementStatus status, AppUser actor) {
        requireViewer(actor);
        return subscriptions.findAllByOrderByRenewalDateAscCreatedAtDesc().stream()
            .filter(subscription -> status == null || subscription.getStatus() == status)
            .filter(subscription -> matches(query, subscription.getServiceName(), subscription.getPlan(), subscription.getOwner(), vendorName(subscription.getVendor())))
            .map(SubscriptionResponse::from)
            .toList();
    }

    @Transactional
    public SubscriptionResponse createSubscription(SubscriptionPayload request, AppUser actor) {
        requireEditor(actor);
        ProcurementSubscription subscription = new ProcurementSubscription();
        subscription.setCreatedBy(actor.getDisplayName());
        applySubscription(subscription, request);
        ProcurementSubscription saved = subscriptions.saveAndFlush(subscription);
        audit(actor, "SUBSCRIPTION_CREATED", "Created subscription " + saved.getServiceName(), "IMPORTANT");
        return SubscriptionResponse.from(saved);
    }

    @Transactional
    public SubscriptionResponse updateSubscription(UUID id, SubscriptionPayload request, AppUser actor) {
        requireEditor(actor);
        ProcurementSubscription subscription = findSubscription(id);
        applySubscription(subscription, request);
        markArchived(subscription.getStatus(), subscription::setArchivedAt);
        ProcurementSubscription saved = subscriptions.saveAndFlush(subscription);
        audit(actor, "SUBSCRIPTION_UPDATED", "Updated subscription " + saved.getServiceName(), "IMPORTANT");
        return SubscriptionResponse.from(saved);
    }

    @Transactional
    public void archiveSubscription(UUID id, AppUser actor) {
        requireFounder(actor);
        ProcurementSubscription subscription = findSubscription(id);
        subscription.setStatus(ProcurementStatus.ARCHIVED);
        subscription.setArchivedAt(Instant.now());
        audit(actor, "SUBSCRIPTION_ARCHIVED", "Archived subscription " + subscription.getServiceName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<ProcurementApprovalResponse> listApprovals(String query, ProcurementStatus status, AppUser actor) {
        requireViewer(actor);
        return approvals.findAllByOrderByCreatedAtDesc().stream()
            .filter(approval -> status == null || approval.getStatus() == status)
            .filter(approval -> matches(query, approval.getApprovalTitle(), approval.getApprovalType(), approval.getRequestedBy(), approval.getApprover()))
            .map(ProcurementApprovalResponse::from)
            .toList();
    }

    @Transactional
    public ProcurementApprovalResponse createApproval(ProcurementApprovalPayload request, AppUser actor) {
        requireEditor(actor);
        ProcurementApproval approval = new ProcurementApproval();
        approval.setRequestedBy(actor.getDisplayName());
        applyApproval(approval, request);
        ProcurementApproval saved = approvals.saveAndFlush(approval);
        audit(actor, "PROCUREMENT_APPROVAL_CREATED", "Created procurement approval " + saved.getApprovalTitle(), "IMPORTANT");
        auditApprovalStatus(actor, "PROCUREMENT_APPROVAL", saved.getApprovalTitle(), null, saved.getStatus());
        return ProcurementApprovalResponse.from(saved);
    }

    @Transactional
    public ProcurementApprovalResponse updateApproval(UUID id, ProcurementApprovalPayload request, AppUser actor) {
        requireEditor(actor);
        ProcurementApproval approval = findApproval(id);
        ProcurementStatus previousStatus = approval.getStatus();
        applyApproval(approval, request);
        markArchived(approval.getStatus(), approval::setArchivedAt);
        ProcurementApproval saved = approvals.saveAndFlush(approval);
        audit(actor, "PROCUREMENT_APPROVAL_UPDATED", "Updated procurement approval " + saved.getApprovalTitle(), "IMPORTANT");
        auditApprovalStatus(actor, "PROCUREMENT_APPROVAL", saved.getApprovalTitle(), previousStatus, saved.getStatus());
        return ProcurementApprovalResponse.from(saved);
    }

    @Transactional
    public void archiveApproval(UUID id, AppUser actor) {
        requireFounder(actor);
        ProcurementApproval approval = findApproval(id);
        approval.setStatus(ProcurementStatus.ARCHIVED);
        approval.setArchivedAt(Instant.now());
        audit(actor, "PROCUREMENT_APPROVAL_ARCHIVED", "Archived procurement approval " + approval.getApprovalTitle(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<VendorDocumentResponse> listVendorDocuments(String query, ProcurementStatus status, AppUser actor) {
        requireViewer(actor);
        return vendorDocuments.findAllByOrderByCreatedAtDesc().stream()
            .filter(document -> status == null || document.getStatus() == status)
            .filter(document -> matches(query, document.getDocumentTitle(), document.getDocumentType(), document.getNotes(), vendorName(document.getVendor())))
            .map(VendorDocumentResponse::from)
            .toList();
    }

    @Transactional
    public VendorDocumentResponse createVendorDocument(VendorDocumentPayload request, AppUser actor) {
        requireEditor(actor);
        VendorDocument document = new VendorDocument();
        document.setCreatedBy(actor.getDisplayName());
        applyVendorDocument(document, request);
        VendorDocument saved = vendorDocuments.saveAndFlush(document);
        audit(actor, "VENDOR_DOCUMENT_LINKED", "Linked vendor document " + saved.getDocumentTitle(), "IMPORTANT");
        return VendorDocumentResponse.from(saved);
    }

    @Transactional
    public VendorDocumentResponse updateVendorDocument(UUID id, VendorDocumentPayload request, AppUser actor) {
        requireEditor(actor);
        VendorDocument document = findVendorDocument(id);
        applyVendorDocument(document, request);
        markArchived(document.getStatus(), document::setArchivedAt);
        VendorDocument saved = vendorDocuments.saveAndFlush(document);
        audit(actor, "VENDOR_DOCUMENT_UPDATED", "Updated vendor document " + saved.getDocumentTitle(), "IMPORTANT");
        return VendorDocumentResponse.from(saved);
    }

    @Transactional
    public void archiveVendorDocument(UUID id, AppUser actor) {
        requireFounder(actor);
        VendorDocument document = findVendorDocument(id);
        document.setStatus(ProcurementStatus.ARCHIVED);
        document.setArchivedAt(Instant.now());
        audit(actor, "VENDOR_DOCUMENT_ARCHIVED", "Archived vendor document " + document.getDocumentTitle(), "WARNING");
    }

    @Transactional(readOnly = true)
    public ProcurementReportResponse report(ProcurementReportType type, AppUser actor) {
        requireViewer(actor);
        ProcurementSummaryResponse summary = summary(actor);
        List<ProcurementMetric> metrics = switch (type) {
            case VENDOR_SUMMARY -> List.of(new ProcurementMetric("Active vendors", summary.activeVendors(), "positive"));
            case PURCHASE_REQUESTS -> List.of(new ProcurementMetric("Pending purchase requests", summary.pendingPurchaseRequests(), "warning"));
            case PURCHASE_ORDERS -> List.of(new ProcurementMetric("Approved purchase orders", summary.approvedPurchaseOrders(), "positive"));
            case VENDOR_BILLS -> List.of(new ProcurementMetric("Unpaid vendor bills", summary.unpaidVendorBills(), "warning"));
            case SUBSCRIPTIONS -> List.of(new ProcurementMetric("Upcoming subscription renewals", summary.upcomingSubscriptionRenewals(), "warning"));
            case APPROVALS -> List.of(new ProcurementMetric("Pending approvals", approvals.findAll().stream().filter(approval -> approval.getStatus() == ProcurementStatus.PENDING_APPROVAL).count(), "warning"));
            case OVERDUE_PAYMENTS -> List.of(new ProcurementMetric("Overdue payments", summary.overduePayments(), "negative"));
        };
        audit(actor, "PROCUREMENT_REPORT_GENERATED", "Generated procurement report " + type, "INFO");
        return new ProcurementReportResponse(type, Instant.now(), metrics, metrics.isEmpty() ? List.of("No information has been added yet.") : List.of());
    }

    private void applyVendor(ProcurementVendor vendor, VendorRequest request) {
        vendor.setVendorName(required(request.vendorName(), "Vendor name"));
        vendor.setCategory(required(request.category(), "Vendor category"));
        vendor.setContactPerson(blankToNull(request.contactPerson()));
        vendor.setPhone(blankToNull(request.phone()));
        vendor.setEmail(blankToNull(request.email()));
        vendor.setGstin(blankToNull(request.gstin()));
        vendor.setPan(blankToNull(request.pan()));
        vendor.setAddress(blankToNull(request.address()));
        vendor.setServiceType(blankToNull(request.serviceType()));
        vendor.setStatus(required(request.status(), "Vendor status"));
        vendor.setNotes(blankToNull(request.notes()));
    }

    private void applyPurchaseRequest(PurchaseRequest record, PurchaseRequestPayload request) {
        record.setRequestTitle(required(request.requestTitle(), "Request title"));
        record.setVendor(request.vendorId() == null ? null : findVendor(request.vendorId()));
        record.setPurpose(required(request.purpose(), "Purpose"));
        record.setEstimatedAmount(money(request.estimatedAmount(), "Estimated amount", false));
        record.setPriority(required(request.priority(), "Priority"));
        record.setRequiredDate(request.requiredDate());
        record.setStatus(required(request.status(), "Status"));
        record.setApprovalStatus(required(request.approvalStatus(), "Approval status"));
        record.setNotes(blankToNull(request.notes()));
    }

    private void applyPurchaseOrder(PurchaseOrder order, PurchaseOrderPayload request) {
        BigDecimal amount = money(request.amount(), "Amount", false);
        BigDecimal taxes = money(request.taxes(), "Taxes", false);
        order.setPoNumber(required(request.poNumber(), "PO number"));
        order.setVendor(request.vendorId() == null ? null : findVendor(request.vendorId()));
        order.setItemsServices(required(request.itemsServices(), "Items/services"));
        order.setAmount(amount);
        order.setTaxes(taxes);
        order.setTotalAmount(amount.add(taxes).setScale(2, RoundingMode.HALF_UP));
        order.setIssueDate(required(request.issueDate(), "Issue date"));
        order.setDueDate(request.dueDate());
        order.setStatus(required(request.status(), "Status"));
        order.setLinkedDocumentId(request.linkedDocumentId());
    }

    private void applyVendorBill(VendorBill bill, VendorBillPayload request, AppUser actor) {
        BigDecimal amount = money(request.amount(), "Amount", false);
        BigDecimal gst = money(request.gst(), "GST", false);
        bill.setBillNumber(required(request.billNumber(), "Bill number"));
        bill.setVendor(request.vendorId() == null ? null : findVendor(request.vendorId()));
        bill.setBillDate(required(request.billDate(), "Bill date"));
        bill.setDueDate(required(request.dueDate(), "Due date"));
        bill.setAmount(amount);
        bill.setGst(gst);
        bill.setTotalAmount(amount.add(gst).setScale(2, RoundingMode.HALF_UP));
        bill.setPaymentStatus(required(request.paymentStatus(), "Payment status"));
        bill.setPurchaseOrder(request.purchaseOrderId() == null ? null : findPurchaseOrder(request.purchaseOrderId()));
        bill.setLinkedDocumentId(request.linkedDocumentId());
        if (request.linkedFinancePayableId() != null) {
            bill.setLinkedFinancePayable(financePayables.findById(request.linkedFinancePayableId()).orElseThrow(() -> new NotFoundException("Finance payable not found.")));
        } else if (bill.getLinkedFinancePayable() == null && bill.getPaymentStatus() != ProcurementStatus.PAID && bill.getPaymentStatus() != ProcurementStatus.CANCELLED && bill.getPaymentStatus() != ProcurementStatus.ARCHIVED) {
            bill.setLinkedFinancePayable(createFinancePayable(bill, actor));
        }
    }

    private void applySubscription(ProcurementSubscription subscription, SubscriptionPayload request) {
        subscription.setServiceName(required(request.serviceName(), "Service name"));
        subscription.setVendor(request.vendorId() == null ? null : findVendor(request.vendorId()));
        subscription.setPlan(blankToNull(request.plan()));
        subscription.setBillingCycle(blankToNull(request.billingCycle()));
        subscription.setAmount(money(request.amount(), "Amount", false));
        subscription.setRenewalDate(request.renewalDate());
        subscription.setAutoRenewalStatus(request.autoRenewalStatus());
        subscription.setOwner(blankToNull(request.owner()));
        subscription.setStatus(required(request.status(), "Status"));
    }

    private void applyApproval(ProcurementApproval approval, ProcurementApprovalPayload request) {
        approval.setApprovalTitle(required(request.approvalTitle(), "Approval title"));
        approval.setApprovalType(required(request.approvalType(), "Approval type"));
        approval.setLinkedRecordType(blankToNull(request.linkedRecordType()));
        approval.setLinkedRecordId(request.linkedRecordId());
        approval.setAmount(money(request.amount(), "Amount", false));
        approval.setStatus(required(request.status(), "Status"));
        approval.setApprover(blankToNull(request.approver()));
        approval.setApprovalNotes(blankToNull(request.approvalNotes()));
        approval.setApprovalDate(request.approvalDate());
        approval.setRejectionReason(blankToNull(request.rejectionReason()));
        if (approval.getStatus() == ProcurementStatus.REJECTED && approval.getRejectionReason() == null) throw new IllegalArgumentException("Rejection reason is required when approval is rejected.");
        if (approval.getStatus() == ProcurementStatus.APPROVED && approval.getApprovalDate() == null) approval.setApprovalDate(LocalDate.now());
    }

    private void applyVendorDocument(VendorDocument document, VendorDocumentPayload request) {
        document.setVendor(request.vendorId() == null ? null : findVendor(request.vendorId()));
        document.setDocumentId(request.documentId());
        document.setDocumentTitle(required(request.documentTitle(), "Document title"));
        document.setDocumentType(blankToNull(request.documentType()));
        document.setStatus(required(request.status(), "Status"));
        document.setNotes(blankToNull(request.notes()));
    }

    private VendorPayable createFinancePayable(VendorBill bill, AppUser actor) {
        VendorPayable payable = new VendorPayable();
        payable.setVendorName(bill.getVendor() == null ? "No vendor linked" : bill.getVendor().getVendorName());
        payable.setBillNumber(bill.getBillNumber());
        payable.setDueDate(bill.getDueDate());
        payable.setAmount(bill.getTotalAmount());
        payable.setPaymentStatus(toFinancePaymentStatus(bill.getPaymentStatus()));
        payable.setCreatedBy(actor.getDisplayName());
        return financePayables.saveAndFlush(payable);
    }

    private void validatePoNumber(String poNumber, PurchaseOrder existing) {
        String normalized = required(poNumber, "PO number");
        if ((existing == null || !existing.getPoNumber().equalsIgnoreCase(normalized)) && purchaseOrders.existsByPoNumberIgnoreCase(normalized)) throw new IllegalArgumentException("PO number already exists.");
    }

    private PaymentStatus toFinancePaymentStatus(ProcurementStatus status) {
        if (status == ProcurementStatus.PAID) return PaymentStatus.PAID;
        if (status == ProcurementStatus.OVERDUE) return PaymentStatus.OVERDUE;
        if (status == ProcurementStatus.CANCELLED || status == ProcurementStatus.ARCHIVED) return PaymentStatus.CANCELLED;
        return PaymentStatus.PENDING;
    }

    private ProcurementVendor findVendor(UUID id) { return vendors.findById(id).orElseThrow(() -> new NotFoundException("Vendor not found.")); }
    private PurchaseRequest findPurchaseRequest(UUID id) { return purchaseRequests.findById(id).orElseThrow(() -> new NotFoundException("Purchase request not found.")); }
    private PurchaseOrder findPurchaseOrder(UUID id) { return purchaseOrders.findById(id).orElseThrow(() -> new NotFoundException("Purchase order not found.")); }
    private VendorBill findVendorBill(UUID id) { return vendorBills.findById(id).orElseThrow(() -> new NotFoundException("Vendor bill not found.")); }
    private ProcurementSubscription findSubscription(UUID id) { return subscriptions.findById(id).orElseThrow(() -> new NotFoundException("Subscription not found.")); }
    private ProcurementApproval findApproval(UUID id) { return approvals.findById(id).orElseThrow(() -> new NotFoundException("Procurement approval not found.")); }
    private VendorDocument findVendorDocument(UUID id) { return vendorDocuments.findById(id).orElseThrow(() -> new NotFoundException("Vendor document not found.")); }

    private boolean unpaidBill(VendorBill bill) { return bill.getArchivedAt() == null && bill.getPaymentStatus() != ProcurementStatus.PAID && bill.getPaymentStatus() != ProcurementStatus.CANCELLED && bill.getPaymentStatus() != ProcurementStatus.ARCHIVED; }
    private boolean active(ProcurementStatus status, Instant archivedAt) { return archivedAt == null && status != ProcurementStatus.ARCHIVED && status != ProcurementStatus.CANCELLED; }
    private String vendorName(ProcurementVendor vendor) { return vendor == null ? null : vendor.getVendorName(); }
    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private void requireFounder(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER); }
    private void audit(AppUser actor, String action, String description, String severity) { auditService.record(actor, MODULE, action, description, severity); }

    private void auditApprovalStatus(AppUser actor, String type, String label, ProcurementStatus previous, ProcurementStatus current) {
        if (current == null || previous == current) return;
        if (current == ProcurementStatus.APPROVED || current == ProcurementStatus.REJECTED || current == ProcurementStatus.PENDING_APPROVAL) {
            audit(actor, type + "_APPROVAL_STATUS_CHANGED", "Changed " + label + " approval status to " + current, "IMPORTANT");
        }
    }

    private void markArchived(ProcurementStatus status, java.util.function.Consumer<Instant> setter) {
        if (status == ProcurementStatus.ARCHIVED) setter.accept(Instant.now());
    }

    private BigDecimal money(BigDecimal value, String label, boolean required) {
        if (value == null) {
            if (required) throw new IllegalArgumentException(label + " is required.");
            return ZERO;
        }
        if (value.scale() > 2) throw new IllegalArgumentException(label + " must have no more than 2 decimal places.");
        if (value.signum() < 0) throw new IllegalArgumentException(label + " cannot be negative.");
        if (value.precision() - value.scale() > 17) throw new IllegalArgumentException(label + " is too large.");
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String required(String value, String label) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(label + " is required.");
        return value.trim();
    }

    private <T> T required(T value, String label) {
        if (value == null) throw new IllegalArgumentException(label + " is required.");
        return value;
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private boolean matches(String query, String... values) {
        if (query == null || query.isBlank()) return true;
        String normalized = query.toLowerCase(Locale.ROOT).trim();
        for (String value : values) {
            if (value != null && value.toLowerCase(Locale.ROOT).contains(normalized)) return true;
        }
        return false;
    }
}
