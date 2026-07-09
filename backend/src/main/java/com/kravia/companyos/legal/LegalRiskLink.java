package com.kravia.companyos.legal;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.legal.LegalEnums.LegalRiskSeverity;
import com.kravia.companyos.legal.LegalEnums.LegalStatus;
import com.kravia.companyos.risk.RiskRegisterEntry;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "legal_risk_links")
public class LegalRiskLink extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private LegalContract contract;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "risk_register_entry_id")
    private RiskRegisterEntry riskRegisterEntry;
    @Column(nullable = false)
    private String riskTitle;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalRiskSeverity severity = LegalRiskSeverity.MEDIUM;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalStatus status = LegalStatus.UNDER_REVIEW;
    private String owner;
    @Column(columnDefinition = "text")
    private String mitigationPlan;
    private LocalDate reviewDate;
    @Column(columnDefinition = "text")
    private String notes;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public LegalContract getContract() { return contract; }
    public void setContract(LegalContract contract) { this.contract = contract; }
    public RiskRegisterEntry getRiskRegisterEntry() { return riskRegisterEntry; }
    public void setRiskRegisterEntry(RiskRegisterEntry riskRegisterEntry) { this.riskRegisterEntry = riskRegisterEntry; }
    public String getRiskTitle() { return riskTitle; }
    public void setRiskTitle(String riskTitle) { this.riskTitle = riskTitle; }
    public LegalRiskSeverity getSeverity() { return severity; }
    public void setSeverity(LegalRiskSeverity severity) { this.severity = severity; }
    public LegalStatus getStatus() { return status; }
    public void setStatus(LegalStatus status) { this.status = status; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getMitigationPlan() { return mitigationPlan; }
    public void setMitigationPlan(String mitigationPlan) { this.mitigationPlan = mitigationPlan; }
    public LocalDate getReviewDate() { return reviewDate; }
    public void setReviewDate(LocalDate reviewDate) { this.reviewDate = reviewDate; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
