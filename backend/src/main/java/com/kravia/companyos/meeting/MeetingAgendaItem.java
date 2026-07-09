package com.kravia.companyos.meeting;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "meeting_agenda_items")
public class MeetingAgendaItem extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meeting_id", nullable = false)
    private BoardMeeting meeting;

    @Column(nullable = false)
    private int sortOrder;

    @Column(nullable = false, length = 2000)
    private String itemText;

    public BoardMeeting getMeeting() { return meeting; }
    public void setMeeting(BoardMeeting meeting) { this.meeting = meeting; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public String getItemText() { return itemText; }
    public void setItemText(String itemText) { this.itemText = itemText; }
}
