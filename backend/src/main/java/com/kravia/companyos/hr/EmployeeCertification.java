package com.kravia.companyos.hr;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.hr.HrEnums.TrainingStatus;
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
@Table(name = "employee_certifications")
public class EmployeeCertification extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "training_id")
    private TrainingRecord training;
    @Column(nullable = false)
    private String certificationName;
    private String provider;
    private LocalDate issueDate;
    private LocalDate expiryDate;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "certificate_document_id")
    private DocumentRecord certificateDocument;
    @Column(columnDefinition = "text")
    private String skillsCovered;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TrainingStatus status;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public TrainingRecord getTraining() { return training; }
    public void setTraining(TrainingRecord training) { this.training = training; }
    public String getCertificationName() { return certificationName; }
    public void setCertificationName(String certificationName) { this.certificationName = certificationName; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public LocalDate getIssueDate() { return issueDate; }
    public void setIssueDate(LocalDate issueDate) { this.issueDate = issueDate; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public DocumentRecord getCertificateDocument() { return certificateDocument; }
    public void setCertificateDocument(DocumentRecord certificateDocument) { this.certificateDocument = certificateDocument; }
    public String getSkillsCovered() { return skillsCovered; }
    public void setSkillsCovered(String skillsCovered) { this.skillsCovered = skillsCovered; }
    public TrainingStatus getStatus() { return status; }
    public void setStatus(TrainingStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
