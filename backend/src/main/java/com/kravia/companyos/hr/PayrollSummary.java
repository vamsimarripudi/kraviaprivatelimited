package com.kravia.companyos.hr;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.hr.HrEnums.PayrollStatus;
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
import java.util.UUID;

@Entity
@Table(name = "payroll_summaries")
public class PayrollSummary extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
    @Column(nullable = false)
    private String payrollMonth;
    private String salaryStructure;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal basicSalary;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal allowances;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal deductions;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal pf;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal esi;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal professionalTax;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal tds;
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal netSalary;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PayrollStatus status;
    private UUID linkedFinancialRecordId;
    @Column(columnDefinition = "text")
    private String notes;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public String getPayrollMonth() { return payrollMonth; }
    public void setPayrollMonth(String payrollMonth) { this.payrollMonth = payrollMonth; }
    public String getSalaryStructure() { return salaryStructure; }
    public void setSalaryStructure(String salaryStructure) { this.salaryStructure = salaryStructure; }
    public BigDecimal getBasicSalary() { return basicSalary; }
    public void setBasicSalary(BigDecimal basicSalary) { this.basicSalary = basicSalary; }
    public BigDecimal getAllowances() { return allowances; }
    public void setAllowances(BigDecimal allowances) { this.allowances = allowances; }
    public BigDecimal getDeductions() { return deductions; }
    public void setDeductions(BigDecimal deductions) { this.deductions = deductions; }
    public BigDecimal getPf() { return pf; }
    public void setPf(BigDecimal pf) { this.pf = pf; }
    public BigDecimal getEsi() { return esi; }
    public void setEsi(BigDecimal esi) { this.esi = esi; }
    public BigDecimal getProfessionalTax() { return professionalTax; }
    public void setProfessionalTax(BigDecimal professionalTax) { this.professionalTax = professionalTax; }
    public BigDecimal getTds() { return tds; }
    public void setTds(BigDecimal tds) { this.tds = tds; }
    public BigDecimal getNetSalary() { return netSalary; }
    public void setNetSalary(BigDecimal netSalary) { this.netSalary = netSalary; }
    public PayrollStatus getStatus() { return status; }
    public void setStatus(PayrollStatus status) { this.status = status; }
    public UUID getLinkedFinancialRecordId() { return linkedFinancialRecordId; }
    public void setLinkedFinancialRecordId(UUID linkedFinancialRecordId) { this.linkedFinancialRecordId = linkedFinancialRecordId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
