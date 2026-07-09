package com.kravia.companyos.procurement;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.financeerp.VendorPayable;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "vendor_bills")
public class VendorBill extends BaseEntity {
    @Column(nullable = false, length = 120)
    private String billNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vendor_id")
    private ProcurementVendor vendor;

    @Column(nullable = false)
    private LocalDate billDate;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal gst = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementStatus paymentStatus = ProcurementStatus.UNPAID;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "purchase_order_id")
    private PurchaseOrder purchaseOrder;

    private UUID linkedDocumentId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "linked_finance_payable_id")
    private VendorPayable linkedFinancePayable;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getBillNumber() { return billNumber; }
    public void setBillNumber(String billNumber) { this.billNumber = billNumber; }
    public ProcurementVendor getVendor() { return vendor; }
    public void setVendor(ProcurementVendor vendor) { this.vendor = vendor; }
    public LocalDate getBillDate() { return billDate; }
    public void setBillDate(LocalDate billDate) { this.billDate = billDate; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getGst() { return gst; }
    public void setGst(BigDecimal gst) { this.gst = gst; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public ProcurementStatus getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(ProcurementStatus paymentStatus) { this.paymentStatus = paymentStatus; }
    public PurchaseOrder getPurchaseOrder() { return purchaseOrder; }
    public void setPurchaseOrder(PurchaseOrder purchaseOrder) { this.purchaseOrder = purchaseOrder; }
    public UUID getLinkedDocumentId() { return linkedDocumentId; }
    public void setLinkedDocumentId(UUID linkedDocumentId) { this.linkedDocumentId = linkedDocumentId; }
    public VendorPayable getLinkedFinancePayable() { return linkedFinancePayable; }
    public void setLinkedFinancePayable(VendorPayable linkedFinancePayable) { this.linkedFinancePayable = linkedFinancePayable; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
