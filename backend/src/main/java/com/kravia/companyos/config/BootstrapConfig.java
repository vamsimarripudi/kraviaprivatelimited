package com.kravia.companyos.config;

import com.kravia.companyos.common.Role;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.StringUtils;

@Configuration
public class BootstrapConfig {
    @Bean
    CommandLineRunner bootstrapFounder(
        UserRepository users,
        PasswordEncoder passwordEncoder,
        @Value("${kravia.bootstrap.founder-email:}") String founderEmail,
        @Value("${kravia.bootstrap.founder-password:}") String founderPassword,
        @Value("${kravia.bootstrap.founder-name:KRAVIA Founder}") String founderName
    ) {
        return args -> {
            if (!StringUtils.hasText(founderEmail) || !StringUtils.hasText(founderPassword)) return;
            users.findByEmailIgnoreCase(founderEmail).orElseGet(() -> {
                AppUser user = new AppUser();
                user.setEmail(founderEmail.trim().toLowerCase());
                user.setDisplayName(founderName);
                user.setRole(Role.FOUNDER);
                user.setPasswordHash(passwordEncoder.encode(founderPassword));
                user.setEnabled(true);
                return users.save(user);
            });
        };
    }
}
