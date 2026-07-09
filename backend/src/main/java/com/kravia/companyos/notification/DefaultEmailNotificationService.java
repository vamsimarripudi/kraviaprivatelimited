package com.kravia.companyos.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class DefaultEmailNotificationService implements EmailNotificationService {
    private static final Logger log = LoggerFactory.getLogger(DefaultEmailNotificationService.class);
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    public DefaultEmailNotificationService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSenderProvider = mailSenderProvider;
    }

    @Override
    public void send(String to, String subject, String body) {
        if (to == null || to.isBlank()) return;
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.info("Email notification skipped because SMTP is not configured.");
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }
}
