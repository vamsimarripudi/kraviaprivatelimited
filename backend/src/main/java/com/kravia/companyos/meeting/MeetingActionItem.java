package com.kravia.companyos.meeting;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "meeting_action_items")
public class MeetingActionItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    private BoardMeeting meeting;

    @Column(nullable = false)
    private int sortOrder;

    @Column(nullable = false, length = 3000)
    private String actionText;

    @Column(nullable = false)
    private String owner;

    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private MeetingActionItemStatus status = MeetingActionItemStatus.TODO;

    public BoardMeeting getMeeting() { return meeting; }
    public void setMeeting(BoardMeeting meeting) { this.meeting = meeting; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public String getActionText() { return actionText; }
    public void setActionText(String actionText) { this.actionText = actionText; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public MeetingActionItemStatus getStatus() { return status; }
    public void setStatus(MeetingActionItemStatus status) { this.status = status; }
}
