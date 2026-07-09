package com.kravia.companyos.financeerp;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.financeerp.FinanceErpEnums.JournalApprovalStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "journal_entries")
public class JournalEntry extends BaseEntity {
    @Column(nullable = false, unique = true, length = 120)
    private String voucherNumber;

    @Column(nullable = false)
    private LocalDate postingDate;

    @Column(nullable = false, length = 4000)
    private String narration;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private JournalApprovalStatus approvalStatus = JournalApprovalStatus.DRAFT;

    private UUID linkedDocumentId;

    @Column(nullable = false)
    private String createdBy;

    private Instant postedAt;
    private Instant archivedAt;

    @OneToMany(mappedBy = "journalEntry", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<JournalEntryLine> lines = new ArrayList<>();

    public String getVoucherNumber() { return voucherNumber; }
    public void setVoucherNumber(String voucherNumber) { this.voucherNumber = voucherNumber; }
    public LocalDate getPostingDate() { return postingDate; }
    public void setPostingDate(LocalDate postingDate) { this.postingDate = postingDate; }
    public String getNarration() { return narration; }
    public void setNarration(String narration) { this.narration = narration; }
    public JournalApprovalStatus getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(JournalApprovalStatus approvalStatus) { this.approvalStatus = approvalStatus; }
    public UUID getLinkedDocumentId() { return linkedDocumentId; }
    public void setLinkedDocumentId(UUID linkedDocumentId) { this.linkedDocumentId = linkedDocumentId; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getPostedAt() { return postedAt; }
    public void setPostedAt(Instant postedAt) { this.postedAt = postedAt; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
    public List<JournalEntryLine> getLines() { return lines; }
    public void setLines(List<JournalEntryLine> lines) { this.lines = lines; }
}
