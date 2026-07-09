package com.kravia.companyos.meeting;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "board_meetings")
public class BoardMeeting extends BaseEntity {
    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private LocalDateTime meetingDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private MeetingType meetingType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private MeetingStatus status = MeetingStatus.DRAFT;

    @Column(length = 6000)
    private String discussionNotes;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    @OneToMany(mappedBy = "meeting", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder asc")
    private List<MeetingAgendaItem> agendaItems = new ArrayList<>();

    @OneToMany(mappedBy = "meeting", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder asc")
    private List<MeetingDecision> decisions = new ArrayList<>();

    @OneToMany(mappedBy = "meeting", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder asc")
    private List<MeetingResolution> resolutions = new ArrayList<>();

    @OneToMany(mappedBy = "meeting", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder asc")
    private List<MeetingActionItem> actionItems = new ArrayList<>();

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public LocalDateTime getMeetingDate() { return meetingDate; }
    public void setMeetingDate(LocalDateTime meetingDate) { this.meetingDate = meetingDate; }
    public MeetingType getMeetingType() { return meetingType; }
    public void setMeetingType(MeetingType meetingType) { this.meetingType = meetingType; }
    public MeetingStatus getStatus() { return status; }
    public void setStatus(MeetingStatus status) { this.status = status; }
    public String getDiscussionNotes() { return discussionNotes; }
    public void setDiscussionNotes(String discussionNotes) { this.discussionNotes = discussionNotes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
    public List<MeetingAgendaItem> getAgendaItems() { return agendaItems; }
    public List<MeetingDecision> getDecisions() { return decisions; }
    public List<MeetingResolution> getResolutions() { return resolutions; }
    public List<MeetingActionItem> getActionItems() { return actionItems; }
}
