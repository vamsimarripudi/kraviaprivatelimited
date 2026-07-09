package com.kravia.companyos.procurement;

import com.kravia.companyos.procurement.ProcurementDto.ProcurementApprovalPayload;
import com.kravia.companyos.procurement.ProcurementDto.ProcurementApprovalResponse;
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
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementReportType;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import com.kravia.companyos.procurement.ProcurementEnums.VendorCategory;
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
@RequestMapping("/procurement")
public class ProcurementController {
    private final ProcurementService service;

    public ProcurementController(ProcurementService service) { this.service = service; }

    @GetMapping("/summary")
    public ProcurementSummaryResponse summary(@AuthenticationPrincipal AppUser actor) {
        return service.summary(actor);
    }

    @GetMapping("/vendors")
    public List<VendorResponse> vendors(@RequestParam(required = false) String query, @RequestParam(required = false) VendorCategory category, @RequestParam(required = false) ProcurementStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listVendors(query, category, status, actor);
    }

    @PostMapping("/vendors")
    public VendorResponse createVendor(@Valid @RequestBody VendorRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createVendor(request, actor);
    }

    @PutMapping("/vendors/{id}")
    public VendorResponse updateVendor(@PathVariable UUID id, @Valid @RequestBody VendorRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateVendor(id, request, actor);
    }

    @DeleteMapping("/vendors/{id}")
    public void archiveVendor(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveVendor(id, actor);
    }

    @GetMapping("/purchase-requests")
    public List<PurchaseRequestResponse> purchaseRequests(@RequestParam(required = false) String query, @RequestParam(required = false) ProcurementStatus status, @RequestParam(required = false) ProcurementStatus approvalStatus, @AuthenticationPrincipal AppUser actor) {
        return service.listPurchaseRequests(query, status, approvalStatus, actor);
    }

    @PostMapping("/purchase-requests")
    public PurchaseRequestResponse createPurchaseRequest(@Valid @RequestBody PurchaseRequestPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createPurchaseRequest(request, actor);
    }

    @PutMapping("/purchase-requests/{id}")
    public PurchaseRequestResponse updatePurchaseRequest(@PathVariable UUID id, @Valid @RequestBody PurchaseRequestPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updatePurchaseRequest(id, request, actor);
    }

    @DeleteMapping("/purchase-requests/{id}")
    public void archivePurchaseRequest(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archivePurchaseRequest(id, actor);
    }

    @GetMapping("/purchase-orders")
    public List<PurchaseOrderResponse> purchaseOrders(@RequestParam(required = false) String query, @RequestParam(required = false) ProcurementStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listPurchaseOrders(query, status, actor);
    }

    @PostMapping("/purchase-orders")
    public PurchaseOrderResponse createPurchaseOrder(@Valid @RequestBody PurchaseOrderPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createPurchaseOrder(request, actor);
    }

    @PutMapping("/purchase-orders/{id}")
    public PurchaseOrderResponse updatePurchaseOrder(@PathVariable UUID id, @Valid @RequestBody PurchaseOrderPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updatePurchaseOrder(id, request, actor);
    }

    @DeleteMapping("/purchase-orders/{id}")
    public void archivePurchaseOrder(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archivePurchaseOrder(id, actor);
    }

    @GetMapping("/vendor-bills")
    public List<VendorBillResponse> vendorBills(@RequestParam(required = false) String query, @RequestParam(required = false) ProcurementStatus paymentStatus, @AuthenticationPrincipal AppUser actor) {
        return service.listVendorBills(query, paymentStatus, actor);
    }

    @PostMapping("/vendor-bills")
    public VendorBillResponse createVendorBill(@Valid @RequestBody VendorBillPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createVendorBill(request, actor);
    }

    @PutMapping("/vendor-bills/{id}")
    public VendorBillResponse updateVendorBill(@PathVariable UUID id, @Valid @RequestBody VendorBillPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateVendorBill(id, request, actor);
    }

    @DeleteMapping("/vendor-bills/{id}")
    public void archiveVendorBill(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveVendorBill(id, actor);
    }

    @GetMapping("/subscriptions")
    public List<SubscriptionResponse> subscriptions(@RequestParam(required = false) String query, @RequestParam(required = false) ProcurementStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listSubscriptions(query, status, actor);
    }

    @PostMapping("/subscriptions")
    public SubscriptionResponse createSubscription(@Valid @RequestBody SubscriptionPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createSubscription(request, actor);
    }

    @PutMapping("/subscriptions/{id}")
    public SubscriptionResponse updateSubscription(@PathVariable UUID id, @Valid @RequestBody SubscriptionPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateSubscription(id, request, actor);
    }

    @DeleteMapping("/subscriptions/{id}")
    public void archiveSubscription(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveSubscription(id, actor);
    }

    @GetMapping("/approvals")
    public List<ProcurementApprovalResponse> approvals(@RequestParam(required = false) String query, @RequestParam(required = false) ProcurementStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listApprovals(query, status, actor);
    }

    @PostMapping("/approvals")
    public ProcurementApprovalResponse createApproval(@Valid @RequestBody ProcurementApprovalPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createApproval(request, actor);
    }

    @PutMapping("/approvals/{id}")
    public ProcurementApprovalResponse updateApproval(@PathVariable UUID id, @Valid @RequestBody ProcurementApprovalPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateApproval(id, request, actor);
    }

    @DeleteMapping("/approvals/{id}")
    public void archiveApproval(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveApproval(id, actor);
    }

    @GetMapping("/vendor-documents")
    public List<VendorDocumentResponse> vendorDocuments(@RequestParam(required = false) String query, @RequestParam(required = false) ProcurementStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listVendorDocuments(query, status, actor);
    }

    @PostMapping("/vendor-documents")
    public VendorDocumentResponse createVendorDocument(@Valid @RequestBody VendorDocumentPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createVendorDocument(request, actor);
    }

    @PutMapping("/vendor-documents/{id}")
    public VendorDocumentResponse updateVendorDocument(@PathVariable UUID id, @Valid @RequestBody VendorDocumentPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateVendorDocument(id, request, actor);
    }

    @DeleteMapping("/vendor-documents/{id}")
    public void archiveVendorDocument(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveVendorDocument(id, actor);
    }

    @GetMapping("/reports")
    public ProcurementReportResponse report(@RequestParam(defaultValue = "VENDOR_SUMMARY") ProcurementReportType type, @AuthenticationPrincipal AppUser actor) {
        return service.report(type, actor);
    }
}
