package com.kravia.companyos.notification;

public interface EmailNotificationService {
    void send(String to, String subject, String body);
}
