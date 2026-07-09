package com.kravia.companyos.setting;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SettingEntryRepository extends JpaRepository<SettingEntry, UUID> {}
