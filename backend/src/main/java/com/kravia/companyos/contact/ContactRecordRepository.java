package com.kravia.companyos.contact;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContactRecordRepository extends JpaRepository<ContactRecord, UUID> {}
