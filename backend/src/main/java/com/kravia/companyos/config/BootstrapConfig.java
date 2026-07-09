package com.kravia.companyos.config;

import com.kravia.companyos.auth.PasswordPolicyService;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.RoleEntity;
import com.kravia.companyos.user.RoleRepository;
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
        RoleRepository roles,
        PasswordEncoder passwordEncoder,
        PasswordPolicyService passwordPolicyService,
        @Value("${kravia.bootstrap.founder-email:}") String founderEmail,
        @Value("${kravia.bootstrap.founder-password:}") String founderPassword,
        @Value("${kravia.bootstrap.founder-name:KRAVIA Founder}") String founderName
    ) {
        return args -> {
            if (!StringUtils.hasText(founderEmail) || !StringUtils.hasText(founderPassword)) return;
            passwordPolicyService.validate(founderPassword);
            users.findByEmailIgnoreCase(founderEmail).orElseGet(() -> {
                RoleEntity founderRole = roles.findById(Role.FOUNDER).orElseThrow(() -> new IllegalStateException("FOUNDER role is missing from the database."));
                AppUser user = new AppUser();
                user.setEmail(founderEmail.trim().toLowerCase());
                user.setDisplayName(StringUtils.hasText(founderName) ? founderName.trim() : "Founder");
                user.setPasswordHash(passwordEncoder.encode(founderPassword));
                user.setEnabled(true);
                user.getRoles().add(founderRole);
                return users.save(user);
            });
        };
    }
}
