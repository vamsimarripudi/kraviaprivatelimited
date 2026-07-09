package com.kravia.companyos.procurement;

import com.kravia.companyos.common.BaseEntity;
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
@Table(name = "purchase_orders")
public class PurchaseOrder extends BaseEntity {
    @Column(nullable = false, unique = true, length = 120)
    private String poNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "vendor_id")
    private ProcurementVendor vendor;

    @Column(nullable = false, length = 4000)
    private String itemsServices;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal taxes = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private LocalDate issueDate;

    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementStatus status = ProcurementStatus.DRAFT;

    private UUID linkedDocumentId;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getPoNumber() { return poNumber; }
    public void setPoNumber(String poNumber) { this.poNumber = poNumber; }
    public ProcurementVendor getVendor() { return vendor; }
    public void setVendor(ProcurementVendor vendor) { this.vendor = vendor; }
    public String getItemsServices() { return itemsServices; }
    public void setItemsServices(String itemsServices) { this.itemsServices = itemsServices; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getTaxes() { return taxes; }
    public void setTaxes(BigDecimal taxes) { this.taxes = taxes; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public LocalDate getIssueDate() { return issueDate; }
    public void setIssueDate(LocalDate issueDate) { this.issueDate = issueDate; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public ProcurementStatus getStatus() { return status; }
    public void setStatus(ProcurementStatus status) { this.status = status; }
    public UUID getLinkedDocumentId() { return linkedDocumentId; }
    public void setLinkedDocumentId(UUID linkedDocumentId) { this.linkedDocumentId = linkedDocumentId; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
