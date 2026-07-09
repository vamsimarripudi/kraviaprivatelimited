package com.kravia.companyos.ai;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "ai_context_snapshots")
public class AiContextSnapshot extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ai_query_id", nullable = false)
    private AiQuery aiQuery;

    @Column(nullable = false, length = 80)
    private String moduleContext;

    @Column(nullable = false, columnDefinition = "text")
    private String snapshotText;

    public AiQuery getAiQuery() { return aiQuery; }
    public void setAiQuery(AiQuery aiQuery) { this.aiQuery = aiQuery; }
    public String getModuleContext() { return moduleContext; }
    public void setModuleContext(String moduleContext) { this.moduleContext = moduleContext; }
    public String getSnapshotText() { return snapshotText; }
    public void setSnapshotText(String snapshotText) { this.snapshotText = snapshotText; }
}
