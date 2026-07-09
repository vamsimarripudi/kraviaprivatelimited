package com.kravia.companyos.ai;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ai_queries")
public class AiQuery extends BaseEntity {
    @Column(nullable = false, length = 2000)
    private String query;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private AiModuleContext moduleContext = AiModuleContext.ALL;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private AiOutputType outputType = AiOutputType.GENERAL_ANSWER;

    private LocalDate dateFrom;

    private LocalDate dateTo;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false, length = 320)
    private String actorEmail;

    @Column(nullable = false, columnDefinition = "text")
    private String response;

    private Instant archivedAt;

    @OneToMany(mappedBy = "aiQuery", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt asc")
    private List<AiContextSnapshot> contextSnapshots = new ArrayList<>();

    public String getQuery() { return query; }
    public void setQuery(String query) { this.query = query; }
    public AiModuleContext getModuleContext() { return moduleContext; }
    public void setModuleContext(AiModuleContext moduleContext) { this.moduleContext = moduleContext; }
    public AiOutputType getOutputType() { return outputType; }
    public void setOutputType(AiOutputType outputType) { this.outputType = outputType; }
    public LocalDate getDateFrom() { return dateFrom; }
    public void setDateFrom(LocalDate dateFrom) { this.dateFrom = dateFrom; }
    public LocalDate getDateTo() { return dateTo; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public void setDateTo(LocalDate dateTo) { this.dateTo = dateTo; }
    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String actorEmail) { this.actorEmail = actorEmail; }
    public String getResponse() { return response; }
    public void setResponse(String response) { this.response = response; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
    public List<AiContextSnapshot> getContextSnapshots() { return contextSnapshots; }
}
