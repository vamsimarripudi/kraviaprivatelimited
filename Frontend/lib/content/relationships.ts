import type { ContentRelationship, PublicContentRecord } from "./types";

export function uniquePublicRelationships(relationships: readonly ContentRelationship[]) {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    if (!relationship.public) return false;
    const key = `${relationship.fromId}:${relationship.predicate}:${relationship.toId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function relatedContent(record: PublicContentRecord, candidates: readonly PublicContentRecord[]) {
  return candidates
    .filter((candidate) => candidate.id !== record.id && candidate.status === "PUBLISHED" && candidate.visibility === "PUBLIC")
    .map((candidate) => ({ candidate, score: Number(candidate.type === record.type) + Number(Boolean(candidate.category && candidate.category === record.category)) + (candidate.relatedEntityIds ?? []).filter((id) => (record.relatedEntityIds ?? []).includes(id)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.candidate.updatedAt.localeCompare(a.candidate.updatedAt))
    .slice(0, 3)
    .map(({ candidate }) => candidate);
}
