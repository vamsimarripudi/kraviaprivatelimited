package com.kravia.companyos.financeerp;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.financeerp.FinanceErpEnums.AccountType;
import com.kravia.companyos.financeerp.FinanceErpEnums.RecordStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "accounts")
public class FinanceAccount extends BaseEntity {
    @Column(nullable = false, unique = true, length = 64)
    private String accountCode;

    @Column(nullable = false)
    private String accountName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AccountType accountType;

    @ManyToOne
    @JoinColumn(name = "parent_account_id")
    private FinanceAccount parentAccount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private RecordStatus status = RecordStatus.ACTIVE;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getAccountCode() { return accountCode; }
    public void setAccountCode(String accountCode) { this.accountCode = accountCode; }
    public String getAccountName() { return accountName; }
    public void setAccountName(String accountName) { this.accountName = accountName; }
    public AccountType getAccountType() { return accountType; }
    public void setAccountType(AccountType accountType) { this.accountType = accountType; }
    public FinanceAccount getParentAccount() { return parentAccount; }
    public void setParentAccount(FinanceAccount parentAccount) { this.parentAccount = parentAccount; }
    public RecordStatus getStatus() { return status; }
    public void setStatus(RecordStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
