package com.kravia.companyos.finance;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "financial_records")
public class FinancialRecord extends BaseEntity {
    @Column(nullable = false, length = 7)
    private String reportingMonth;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal revenue;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal expenses;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal profitOrLoss;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal cashBalance;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal receivables;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal payables;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal gstCollected;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal gstPaid;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal netGstPosition;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal cloudSubscriptions;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal vendorPayments;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal directorRemuneration;

    @Column(length = 4000)
    private String founderNotes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private FinancialRecordStatus status = FinancialRecordStatus.DRAFT;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getReportingMonth() { return reportingMonth; }
    public void setReportingMonth(String reportingMonth) { this.reportingMonth = reportingMonth; }
    public BigDecimal getRevenue() { return revenue; }
    public void setRevenue(BigDecimal revenue) { this.revenue = revenue; }
    public BigDecimal getExpenses() { return expenses; }
    public void setExpenses(BigDecimal expenses) { this.expenses = expenses; }
    public BigDecimal getProfitOrLoss() { return profitOrLoss; }
    public void setProfitOrLoss(BigDecimal profitOrLoss) { this.profitOrLoss = profitOrLoss; }
    public BigDecimal getCashBalance() { return cashBalance; }
    public void setCashBalance(BigDecimal cashBalance) { this.cashBalance = cashBalance; }
    public BigDecimal getReceivables() { return receivables; }
    public void setReceivables(BigDecimal receivables) { this.receivables = receivables; }
    public BigDecimal getPayables() { return payables; }
    public void setPayables(BigDecimal payables) { this.payables = payables; }
    public BigDecimal getGstCollected() { return gstCollected; }
    public void setGstCollected(BigDecimal gstCollected) { this.gstCollected = gstCollected; }
    public BigDecimal getGstPaid() { return gstPaid; }
    public void setGstPaid(BigDecimal gstPaid) { this.gstPaid = gstPaid; }
    public BigDecimal getNetGstPosition() { return netGstPosition; }
    public void setNetGstPosition(BigDecimal netGstPosition) { this.netGstPosition = netGstPosition; }
    public BigDecimal getCloudSubscriptions() { return cloudSubscriptions; }
    public void setCloudSubscriptions(BigDecimal cloudSubscriptions) { this.cloudSubscriptions = cloudSubscriptions; }
    public BigDecimal getVendorPayments() { return vendorPayments; }
    public void setVendorPayments(BigDecimal vendorPayments) { this.vendorPayments = vendorPayments; }
    public BigDecimal getDirectorRemuneration() { return directorRemuneration; }
    public void setDirectorRemuneration(BigDecimal directorRemuneration) { this.directorRemuneration = directorRemuneration; }
    public String getFounderNotes() { return founderNotes; }
    public void setFounderNotes(String founderNotes) { this.founderNotes = founderNotes; }
    public FinancialRecordStatus getStatus() { return status; }
    public void setStatus(FinancialRecordStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
