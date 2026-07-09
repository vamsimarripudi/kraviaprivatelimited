package com.kravia.companyos.product;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRecordRepository extends JpaRepository<ProductRecord, UUID> {}
