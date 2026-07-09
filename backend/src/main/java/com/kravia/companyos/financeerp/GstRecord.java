package com.kravia.companyos.financeerp;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.financeerp.FinanceErpEnums.GstFilingStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "gst_records")
public class GstRecord extends BaseEntity {
    @Column(nullable = false, length = 7)
    private String filingPeriod;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal gstCollected = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal gstPaid = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal inputTaxCredit = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal outputTax = BigDecimal.ZERO;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal netGstPosition = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private GstFilingStatus filingStatus = GstFilingStatus.DRAFT;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getFilingPeriod() { return filingPeriod; }
    public void setFilingPeriod(String filingPeriod) { this.filingPeriod = filingPeriod; }
    public BigDecimal getGstCollected() { return gstCollected; }
    public void setGstCollected(BigDecimal gstCollected) { this.gstCollected = gstCollected; }
    public BigDecimal getGstPaid() { return gstPaid; }
    public void setGstPaid(BigDecimal gstPaid) { this.gstPaid = gstPaid; }
    public BigDecimal getInputTaxCredit() { return inputTaxCredit; }
    public void setInputTaxCredit(BigDecimal inputTaxCredit) { this.inputTaxCredit = inputTaxCredit; }
    public BigDecimal getOutputTax() { return outputTax; }
    public void setOutputTax(BigDecimal outputTax) { this.outputTax = outputTax; }
    public BigDecimal getNetGstPosition() { return netGstPosition; }
    public void setNetGstPosition(BigDecimal netGstPosition) { this.netGstPosition = netGstPosition; }
    public GstFilingStatus getFilingStatus() { return filingStatus; }
    public void setFilingStatus(GstFilingStatus filingStatus) { this.filingStatus = filingStatus; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
