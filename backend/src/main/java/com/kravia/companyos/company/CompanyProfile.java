package com.kravia.companyos.company;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "company_profile")
public class CompanyProfile extends BaseEntity {
    private String companyName;
    private String cin;
    private String pan;
    private String tan;
    @Column(length = 2000)
    private String registeredOfficeAddress;
    private String email;
    private String phone;
    private LocalDate dateOfIncorporation;
    private String authorizedCapital;
    private String paidUpCapital;
    @Column(length = 2000)
    private String directors;
    @Column(length = 2000)
    private String shareholders;
    private String companyStatus;
    private LocalDate lastUpdatedDate;

    public String getCompanyName() { return companyName; }
    public void setCompanyName(String companyName) { this.companyName = companyName; }
    public String getCin() { return cin; }
    public void setCin(String cin) { this.cin = cin; }
    public String getPan() { return pan; }
    public void setPan(String pan) { this.pan = pan; }
    public String getTan() { return tan; }
    public void setTan(String tan) { this.tan = tan; }
    public String getRegisteredOfficeAddress() { return registeredOfficeAddress; }
    public void setRegisteredOfficeAddress(String registeredOfficeAddress) { this.registeredOfficeAddress = registeredOfficeAddress; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public LocalDate getDateOfIncorporation() { return dateOfIncorporation; }
    public void setDateOfIncorporation(LocalDate dateOfIncorporation) { this.dateOfIncorporation = dateOfIncorporation; }
    public String getAuthorizedCapital() { return authorizedCapital; }
    public void setAuthorizedCapital(String authorizedCapital) { this.authorizedCapital = authorizedCapital; }
    public String getPaidUpCapital() { return paidUpCapital; }
    public void setPaidUpCapital(String paidUpCapital) { this.paidUpCapital = paidUpCapital; }
    public String getDirectors() { return directors; }
    public void setDirectors(String directors) { this.directors = directors; }
    public String getShareholders() { return shareholders; }
    public void setShareholders(String shareholders) { this.shareholders = shareholders; }
    public String getCompanyStatus() { return companyStatus; }
    public void setCompanyStatus(String companyStatus) { this.companyStatus = companyStatus; }
    public LocalDate getLastUpdatedDate() { return lastUpdatedDate; }
    public void setLastUpdatedDate(LocalDate lastUpdatedDate) { this.lastUpdatedDate = lastUpdatedDate; }
}
