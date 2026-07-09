package com.kravia.companyos.notification;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {
    List<Notification> findByArchivedAtIsNullOrderByCreatedAtDesc();
    List<Notification> findByRecipientEmailIgnoreCaseAndArchivedAtIsNullOrderByCreatedAtDesc(String recipientEmail);
}