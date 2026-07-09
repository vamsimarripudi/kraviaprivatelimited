package com.kravia.companyos.search;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class SearchService {
    private final JdbcTemplate jdbcTemplate;

    public SearchService(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }

    public List<SearchResult> search(String query) {
        if (query == null || query.isBlank()) return List.of();
        String pattern = "%" + query.trim().toLowerCase() + "%";
        String sql = """
            SELECT 'company-profile' module, id::text id, company_name title, coalesce(company_status, '') status FROM company_profiles WHERE lower(company_name) LIKE ?
            UNION ALL SELECT 'documents', id::text, title, status FROM documents WHERE lower(title) LIKE ?
            UNION ALL SELECT 'products', id::text, title, status FROM products WHERE lower(title) LIKE ?
            UNION ALL SELECT 'contacts', id::text, title, status FROM contacts WHERE lower(title) LIKE ?
            UNION ALL SELECT 'tasks', id::text, title, status FROM company_tasks WHERE lower(title) LIKE ?
            ORDER BY module, title
            LIMIT 50
        """;
        return jdbcTemplate.query(sql, (rs, rowNum) -> new SearchResult(rs.getString("module"), rs.getString("id"), rs.getString("title"), rs.getString("status")), pattern, pattern, pattern, pattern, pattern);
    }
}
