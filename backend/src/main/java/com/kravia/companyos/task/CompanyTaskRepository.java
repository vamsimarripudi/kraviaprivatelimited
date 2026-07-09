package com.kravia.companyos.task;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanyTaskRepository extends JpaRepository<CompanyTask, UUID> {
    @Query("""
        select t from CompanyTask t
        where (:query is null or :query = '' or lower(t.title) like lower(concat('%', :query, '%')) or lower(coalesce(t.description, '')) like lower(concat('%', :query, '%')) or lower(coalesce(t.notes, '')) like lower(concat('%', :query, '%')) or lower(coalesce(t.assignedTo, '')) like lower(concat('%', :query, '%')))
          and (:category is null or t.category = :category)
          and (:assignee is null or :assignee = '' or lower(coalesce(t.assignedTo, '')) like lower(concat('%', :assignee, '%')))
          and (:status is null or t.status = :status)
          and (:priority is null or t.priority = :priority)
        order by case when t.dueDate is null then 1 else 0 end, t.dueDate asc, t.updatedAt desc
    """)
    List<CompanyTask> search(
        @Param("query") String query,
        @Param("category") TaskCategory category,
        @Param("assignee") String assignee,
        @Param("status") TaskStatus status,
        @Param("priority") TaskPriority priority
    );
}