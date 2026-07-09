package com.kravia.companyos.contact;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "contacts")
public class CompanyContact extends BaseEntity {
    @Column(nullable = false)
    private String name;

    private String organization;

    private String role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private ContactCategory category;

    private String phone;

    private String email;

    @Column(length = 4000)
    private String notes;

    private UUID relatedDocumentId;

    private UUID relatedTaskId;

    private LocalDate lastContactedDate;

    private LocalDate nextFollowUpDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ContactStatus status = ContactStatus.ACTIVE;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getOrganization() { return organization; }
    public void setOrganization(String organization) { this.organization = organization; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public ContactCategory getCategory() { return category; }
    public void setCategory(ContactCategory category) { this.category = category; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getRelatedDocumentId() { return relatedDocumentId; }
    public void setRelatedDocumentId(UUID relatedDocumentId) { this.relatedDocumentId = relatedDocumentId; }
    public UUID getRelatedTaskId() { return relatedTaskId; }
    public void setRelatedTaskId(UUID relatedTaskId) { this.relatedTaskId = relatedTaskId; }
    public LocalDate getLastContactedDate() { return lastContactedDate; }
    public void setLastContactedDate(LocalDate lastContactedDate) { this.lastContactedDate = lastContactedDate; }
    public LocalDate getNextFollowUpDate() { return nextFollowUpDate; }
    public void setNextFollowUpDate(LocalDate nextFollowUpDate) { this.nextFollowUpDate = nextFollowUpDate; }
    public ContactStatus getStatus() { return status; }
    public void setStatus(ContactStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}