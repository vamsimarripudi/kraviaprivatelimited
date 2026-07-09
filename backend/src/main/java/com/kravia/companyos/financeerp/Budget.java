package com.kravia.companyos.financeerp;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.financeerp.FinanceErpEnums.BudgetStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.BudgetType;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "budgets")
public class Budget extends BaseEntity {
    @Column(nullable = false)
    private String budgetName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private BudgetType budgetType;

    @Column(nullable = false, length = 9)
    private String financialYear;

    private String department;
    private String product;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal annualBudget = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private BudgetStatus status = BudgetStatus.DRAFT;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    @OneToMany(mappedBy = "budget", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BudgetLine> lines = new ArrayList<>();

    public String getBudgetName() { return budgetName; }
    public void setBudgetName(String budgetName) { this.budgetName = budgetName; }
    public BudgetType getBudgetType() { return budgetType; }
    public void setBudgetType(BudgetType budgetType) { this.budgetType = budgetType; }
    public String getFinancialYear() { return financialYear; }
    public void setFinancialYear(String financialYear) { this.financialYear = financialYear; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getProduct() { return product; }
    public void setProduct(String product) { this.product = product; }
    public BigDecimal getAnnualBudget() { return annualBudget; }
    public void setAnnualBudget(BigDecimal annualBudget) { this.annualBudget = annualBudget; }
    public BudgetStatus getStatus() { return status; }
    public void setStatus(BudgetStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
    public List<BudgetLine> getLines() { return lines; }
    public void setLines(List<BudgetLine> lines) { this.lines = lines; }
}
