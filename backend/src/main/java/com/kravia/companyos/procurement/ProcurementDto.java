package com.kravia.companyos.procurement;

import com.kravia.companyos.financeerp.VendorPayable;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementPriority;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementReportType;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import com.kravia.companyos.procurement.ProcurementEnums.VendorCategory;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class ProcurementDto {
    private ProcurementDto() {}

    public record ProcurementMetric(String label, long value, String tone) {}

    public record ProcurementSummaryResponse(
        long activeVendors,
        long pendingPurchaseRequests,
        long approvedPurchaseOrders,
        long unpaidVendorBills,
        long upcomingSubscriptionRenewals,
        long overduePayments,
        List<ProcurementMetric> metrics
    ) {}

    public record VendorRequest(
        @NotBlank @Size(max = 255) String vendorName,
        @NotNull VendorCategory category,
        @Size(max = 255) String contactPerson,
        @Size(max = 80) String phone,
        @Email @Size(max = 255) String email,
        @Size(max = 32) String gstin,
        @Size(max = 32) String pan,
        @Size(max = 4000) String address,
        @Size(max = 255) String serviceType,
        @NotNull ProcurementStatus status,
        @Size(max = 4000) String notes
    ) {}

    public record VendorResponse(
        UUID id,
        String vendorName,
        VendorCategory category,
        String contactPerson,
        String phone,
        String email,
        String gstin,
        String pan,
        String address,
        String serviceType,
        ProcurementStatus status,
        String notes,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static VendorResponse from(ProcurementVendor vendor) {
            return new VendorResponse(vendor.getId(), vendor.getVendorName(), vendor.getCategory(), vendor.getContactPerson(), vendor.getPhone(), vendor.getEmail(), vendor.getGstin(), vendor.getPan(), vendor.getAddress(), vendor.getServiceType(), vendor.getStatus(), vendor.getNotes(), vendor.getCreatedBy(), vendor.getCreatedAt(), vendor.getUpdatedAt(), vendor.getArchivedAt());
        }
    }

    public record PurchaseRequestPayload(
        @NotBlank @Size(max = 255) String requestTitle,
        UUID vendorId,
        @NotBlank @Size(max = 4000) String purpose,
        BigDecimal estimatedAmount,
        @NotNull ProcurementPriority priority,
        LocalDate requiredDate,
        @NotNull ProcurementStatus status,
        @NotNull ProcurementStatus approvalStatus,
        @Size(max = 4000) String notes
    ) {}

    public record PurchaseRequestResponse(
        UUID id,
        String requestTitle,
        UUID vendorId,
        String vendorName,
        String purpose,
        BigDecimal estimatedAmount,
        ProcurementPriority priority,
        String requestedBy,
        LocalDate requiredDate,
        ProcurementStatus status,
        ProcurementStatus approvalStatus,
        String notes,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static PurchaseRequestResponse from(PurchaseRequest request) {
            ProcurementVendor vendor = request.getVendor();
            return new PurchaseRequestResponse(request.getId(), request.getRequestTitle(), vendor == null ? null : vendor.getId(), vendor == null ? null : vendor.getVendorName(), request.getPurpose(), request.getEstimatedAmount(), request.getPriority(), request.getRequestedBy(), request.getRequiredDate(), request.getStatus(), request.getApprovalStatus(), request.getNotes(), request.getCreatedAt(), request.getUpdatedAt(), request.getArchivedAt());
        }
    }

    public record PurchaseOrderPayload(
        @NotBlank @Size(max = 120) String poNumber,
        UUID vendorId,
        @NotBlank @Size(max = 4000) String itemsServices,
        BigDecimal amount,
        BigDecimal taxes,
        @NotNull LocalDate issueDate,
        LocalDate dueDate,
        @NotNull ProcurementStatus status,
        UUID linkedDocumentId
    ) {}

    public record PurchaseOrderResponse(
        UUID id,
        String poNumber,
        UUID vendorId,
        String vendorName,
        String itemsServices,
        BigDecimal amount,
        BigDecimal taxes,
        BigDecimal totalAmount,
        LocalDate issueDate,
        LocalDate dueDate,
        ProcurementStatus status,
        UUID linkedDocumentId,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static PurchaseOrderResponse from(PurchaseOrder order) {
            ProcurementVendor vendor = order.getVendor();
            return new PurchaseOrderResponse(order.getId(), order.getPoNumber(), vendor == null ? null : vendor.getId(), vendor == null ? null : vendor.getVendorName(), order.getItemsServices(), order.getAmount(), order.getTaxes(), order.getTotalAmount(), order.getIssueDate(), order.getDueDate(), order.getStatus(), order.getLinkedDocumentId(), order.getCreatedBy(), order.getCreatedAt(), order.getUpdatedAt(), order.getArchivedAt());
        }
    }

    public record VendorBillPayload(
        @NotBlank @Size(max = 120) String billNumber,
        UUID vendorId,
        @NotNull LocalDate billDate,
        @NotNull LocalDate dueDate,
        BigDecimal amount,
        BigDecimal gst,
        @NotNull ProcurementStatus paymentStatus,
        UUID purchaseOrderId,
        UUID linkedDocumentId,
        UUID linkedFinancePayableId
    ) {}

    public record VendorBillResponse(
        UUID id,
        String billNumber,
        UUID vendorId,
        String vendorName,
        LocalDate billDate,
        LocalDate dueDate,
        BigDecimal amount,
        BigDecimal gst,
        BigDecimal totalAmount,
        ProcurementStatus paymentStatus,
        UUID purchaseOrderId,
        String poNumber,
        UUID linkedDocumentId,
        UUID linkedFinancePayableId,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static VendorBillResponse from(VendorBill bill) {
            ProcurementVendor vendor = bill.getVendor();
            PurchaseOrder order = bill.getPurchaseOrder();
            VendorPayable payable = bill.getLinkedFinancePayable();
            return new VendorBillResponse(bill.getId(), bill.getBillNumber(), vendor == null ? null : vendor.getId(), vendor == null ? null : vendor.getVendorName(), bill.getBillDate(), bill.getDueDate(), bill.getAmount(), bill.getGst(), bill.getTotalAmount(), bill.getPaymentStatus(), order == null ? null : order.getId(), order == null ? null : order.getPoNumber(), bill.getLinkedDocumentId(), payable == null ? null : payable.getId(), bill.getCreatedBy(), bill.getCreatedAt(), bill.getUpdatedAt(), bill.getArchivedAt());
        }
    }

    public record SubscriptionPayload(
        @NotBlank @Size(max = 255) String serviceName,
        UUID vendorId,
        @Size(max = 255) String plan,
        @Size(max = 80) String billingCycle,
        BigDecimal amount,
        LocalDate renewalDate,
        boolean autoRenewalStatus,
        @Size(max = 255) String owner,
        @NotNull ProcurementStatus status
    ) {}

    public record SubscriptionResponse(
        UUID id,
        String serviceName,
        UUID vendorId,
        String vendorName,
        String plan,
        String billingCycle,
        BigDecimal amount,
        LocalDate renewalDate,
        boolean autoRenewalStatus,
        String owner,
        ProcurementStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static SubscriptionResponse from(ProcurementSubscription subscription) {
            ProcurementVendor vendor = subscription.getVendor();
            return new SubscriptionResponse(subscription.getId(), subscription.getServiceName(), vendor == null ? null : vendor.getId(), vendor == null ? null : vendor.getVendorName(), subscription.getPlan(), subscription.getBillingCycle(), subscription.getAmount(), subscription.getRenewalDate(), subscription.isAutoRenewalStatus(), subscription.getOwner(), subscription.getStatus(), subscription.getCreatedBy(), subscription.getCreatedAt(), subscription.getUpdatedAt(), subscription.getArchivedAt());
        }
    }

    public record ProcurementApprovalPayload(
        @NotBlank @Size(max = 255) String approvalTitle,
        @NotBlank @Size(max = 80) String approvalType,
        @Size(max = 120) String linkedRecordType,
        UUID linkedRecordId,
        BigDecimal amount,
        @NotNull ProcurementStatus status,
        @Size(max = 255) String approver,
        @Size(max = 4000) String approvalNotes,
        LocalDate approvalDate,
        @Size(max = 4000) String rejectionReason
    ) {}

    public record ProcurementApprovalResponse(
        UUID id,
        String approvalTitle,
        String approvalType,
        String linkedRecordType,
        UUID linkedRecordId,
        BigDecimal amount,
        ProcurementStatus status,
        String requestedBy,
        String approver,
        String approvalNotes,
        LocalDate approvalDate,
        String rejectionReason,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static ProcurementApprovalResponse from(ProcurementApproval approval) {
            return new ProcurementApprovalResponse(approval.getId(), approval.getApprovalTitle(), approval.getApprovalType(), approval.getLinkedRecordType(), approval.getLinkedRecordId(), approval.getAmount(), approval.getStatus(), approval.getRequestedBy(), approval.getApprover(), approval.getApprovalNotes(), approval.getApprovalDate(), approval.getRejectionReason(), approval.getCreatedAt(), approval.getUpdatedAt(), approval.getArchivedAt());
        }
    }

    public record VendorDocumentPayload(
        UUID vendorId,
        UUID documentId,
        @NotBlank @Size(max = 255) String documentTitle,
        @Size(max = 120) String documentType,
        @NotNull ProcurementStatus status,
        @Size(max = 4000) String notes
    ) {}

    public record VendorDocumentResponse(
        UUID id,
        UUID vendorId,
        String vendorName,
        UUID documentId,
        String documentTitle,
        String documentType,
        ProcurementStatus status,
        String notes,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static VendorDocumentResponse from(VendorDocument document) {
            ProcurementVendor vendor = document.getVendor();
            return new VendorDocumentResponse(document.getId(), vendor == null ? null : vendor.getId(), vendor == null ? null : vendor.getVendorName(), document.getDocumentId(), document.getDocumentTitle(), document.getDocumentType(), document.getStatus(), document.getNotes(), document.getCreatedBy(), document.getCreatedAt(), document.getUpdatedAt(), document.getArchivedAt());
        }
    }

    public record ProcurementReportResponse(
        ProcurementReportType reportType,
        Instant generatedAt,
        List<ProcurementMetric> metrics,
        List<String> notes
    ) {}
}
