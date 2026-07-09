package com.kravia.companyos.meeting;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoardMeetingRepository extends JpaRepository<BoardMeeting, UUID> {
    @Query("""
        select m from BoardMeeting m
        where (:query is null or :query = '' or lower(m.title) like lower(concat('%', :query, '%')) or lower(coalesce(m.discussionNotes, '')) like lower(concat('%', :query, '%')))
          and (:meetingType is null or m.meetingType = :meetingType)
          and (:status is null or m.status = :status)
        order by m.meetingDate desc, m.updatedAt desc
    """)
    List<BoardMeeting> search(@Param("query") String query, @Param("meetingType") MeetingType meetingType, @Param("status") MeetingStatus status);
}
