package com.kravia.companyos.meeting;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MeetingActionItemRepository extends JpaRepository<MeetingActionItem, UUID> {}
