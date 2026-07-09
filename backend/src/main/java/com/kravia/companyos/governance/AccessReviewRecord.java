package com.kravia.companyos.governance;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "access_review_records")
public class AccessReviewRecord extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AccessReviewStatus reviewStatus = AccessReviewStatus.PENDING_REVIEW;

    @Column(length = 320)
    private String reviewedBy;

    private Instant reviewedAt;

    @Column(length = 2000)
    private String notes;

    @Column(nullable = false, length = 40)
    private String quarterLabel;

    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }
    public AccessReviewStatus getReviewStatus() { return reviewStatus; }
    public void setReviewStatus(AccessReviewStatus reviewStatus) { this.reviewStatus = reviewStatus; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getQuarterLabel() { return quarterLabel; }
    public void setQuarterLabel(String quarterLabel) { this.quarterLabel = quarterLabel; }
}
