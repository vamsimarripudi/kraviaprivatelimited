package com.kravia.companyos.procurement;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import com.kravia.companyos.procurement.ProcurementEnums.VendorCategory;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "procurement_vendors")
public class ProcurementVendor extends BaseEntity {
    @Column(nullable = false)
    private String vendorName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private VendorCategory category;

    private String contactPerson;
    private String phone;
    private String email;
    private String gstin;
    private String pan;

    @Column(length = 4000)
    private String address;

    private String serviceType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProcurementStatus status = ProcurementStatus.ACTIVE;

    @Column(length = 4000)
    private String notes;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getVendorName() { return vendorName; }
    public void setVendorName(String vendorName) { this.vendorName = vendorName; }
    public VendorCategory getCategory() { return category; }
    public void setCategory(VendorCategory category) { this.category = category; }
    public String getContactPerson() { return contactPerson; }
    public void setContactPerson(String contactPerson) { this.contactPerson = contactPerson; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getGstin() { return gstin; }
    public void setGstin(String gstin) { this.gstin = gstin; }
    public String getPan() { return pan; }
    public void setPan(String pan) { this.pan = pan; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getServiceType() { return serviceType; }
    public void setServiceType(String serviceType) { this.serviceType = serviceType; }
    public ProcurementStatus getStatus() { return status; }
    public void setStatus(ProcurementStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
