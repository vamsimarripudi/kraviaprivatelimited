package com.kravia.companyos.hr;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.hr.HrEnums.EmploymentStatus;
import com.kravia.companyos.hr.HrEnums.PerformanceRating;
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
import java.util.UUID;

@Entity
@Table(name = "performance_reviews")
public class PerformanceReview extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
    @Column(nullable = false)
    private String reviewCycle;
    @Column(columnDefinition = "text")
    private String goals;
    @Column(columnDefinition = "text")
    private String achievements;
    @Column(columnDefinition = "text")
    private String managerFeedback;
    @Column(columnDefinition = "text")
    private String employeeFeedback;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PerformanceRating rating;
    @Column(columnDefinition = "text")
    private String improvementPlan;
    private LocalDate reviewDate;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id")
    private Employee reviewer;
    private UUID relatedTaskId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EmploymentStatus status;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public String getReviewCycle() { return reviewCycle; }
    public void setReviewCycle(String reviewCycle) { this.reviewCycle = reviewCycle; }
    public String getGoals() { return goals; }
    public void setGoals(String goals) { this.goals = goals; }
    public String getAchievements() { return achievements; }
    public void setAchievements(String achievements) { this.achievements = achievements; }
    public String getManagerFeedback() { return managerFeedback; }
    public void setManagerFeedback(String managerFeedback) { this.managerFeedback = managerFeedback; }
    public String getEmployeeFeedback() { return employeeFeedback; }
    public void setEmployeeFeedback(String employeeFeedback) { this.employeeFeedback = employeeFeedback; }
    public PerformanceRating getRating() { return rating; }
    public void setRating(PerformanceRating rating) { this.rating = rating; }
    public String getImprovementPlan() { return improvementPlan; }
    public void setImprovementPlan(String improvementPlan) { this.improvementPlan = improvementPlan; }
    public LocalDate getReviewDate() { return reviewDate; }
    public void setReviewDate(LocalDate reviewDate) { this.reviewDate = reviewDate; }
    public Employee getReviewer() { return reviewer; }
    public void setReviewer(Employee reviewer) { this.reviewer = reviewer; }
    public UUID getRelatedTaskId() { return relatedTaskId; }
    public void setRelatedTaskId(UUID relatedTaskId) { this.relatedTaskId = relatedTaskId; }
    public EmploymentStatus getStatus() { return status; }
    public void setStatus(EmploymentStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
