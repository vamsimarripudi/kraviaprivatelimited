package com.kravia.companyos.sales;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "sales_leads")
public class SalesLead extends BaseEntity {
    @Column(nullable = false)
    private String leadName;

    @Column(nullable = false)
    private String organizationName;

    private String contactPerson;
    private String phone;
    private String email;

    @Column(nullable = false)
    private String productInterest;

    private String leadSource;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private LeadStage stage = LeadStage.NEW;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private LeadPriority priority = LeadPriority.MEDIUM;

    private String assignedPerson;
    private LocalDate lastContactedDate;
    private LocalDate nextFollowUpDate;

    @Column(length = 4000)
    private String notes;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getLeadName() { return leadName; }
    public void setLeadName(String leadName) { this.leadName = leadName; }
    public String getOrganizationName() { return organizationName; }
    public void setOrganizationName(String organizationName) { this.organizationName = organizationName; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getProductInterest() { return productInterest; }
    public void setProductInterest(String productInterest) { this.productInterest = productInterest; }
    public String getLeadSource() { return leadSource; }
    public void setLeadSource(String leadSource) { this.leadSource = leadSource; }
    public LeadStage getStage() { return stage; }
    public void setStage(LeadStage stage) { this.stage = stage; }
    public LeadPriority getPriority() { return priority; }
    public void setPriority(LeadPriority priority) { this.priority = priority; }
    public String getAssignedPerson() { return assignedPerson; }
    public void setAssignedPerson(String assignedPerson) { this.assignedPerson = assignedPerson; }
    public LocalDate getLastContactedDate() { return lastContactedDate; }
    public void setLastContactedDate(LocalDate lastContactedDate) { this.lastContactedDate = lastContactedDate; }
    public LocalDate getNextFollowUpDate() { return nextFollowUpDate; }
    public void setNextFollowUpDate(LocalDate nextFollowUpDate) { this.nextFollowUpDate = nextFollowUpDate; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
