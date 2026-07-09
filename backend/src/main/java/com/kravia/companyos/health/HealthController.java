package com.kravia.companyos.health;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.time.Instant;
import java.util.Map;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/health")
public class HealthController {
    private final DataSource dataSource;
    private final Flyway flyway;
    private final Path storageRoot;

    public HealthController(DataSource dataSource, Flyway flyway, @Value("${kravia.documents.storage-root}") String storageRoot) {
        this.dataSource = dataSource;
        this.flyway = flyway;
        this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
    }

    @GetMapping
    public HealthResponse overall() {
        return new HealthResponse("UP", Instant.now(), Map.of("service", "kravia-company-os", "database", databaseStatus(), "storage", storageStatus(), "migration", migrationStatus()));
    }

    @GetMapping("/database")
    public HealthResponse database() {
        return new HealthResponse(databaseStatus(), Instant.now(), Map.of("migration", migrationStatus()));
    }

    @GetMapping("/storage")
    public HealthResponse storage() {
        return new HealthResponse(storageStatus(), Instant.now(), Map.of("provider", "local-private-storage"));
    }

    private String databaseStatus() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(2) ? "UP" : "DOWN";
        } catch (Exception ex) {
            return "DOWN";
        }
    }

    private String storageStatus() {
        try {
            Files.createDirectories(storageRoot);
            return Files.isDirectory(storageRoot) && Files.isWritable(storageRoot) ? "UP" : "DOWN";
        } catch (Exception ex) {
            return "DOWN";
        }
    }

    private String migrationStatus() {
        try {
            return flyway.info().pending().length == 0 ? "UP_TO_DATE" : "PENDING";
        } catch (Exception ex) {
            return "UNKNOWN";
        }
    }
}
