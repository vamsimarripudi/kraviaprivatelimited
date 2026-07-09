package com.kravia.companyos.meeting;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardMeetingRepository extends JpaRepository<BoardMeeting, UUID> {}
