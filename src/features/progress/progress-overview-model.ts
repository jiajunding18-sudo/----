import type { KnowledgeView } from "@/features/knowledge/knowledge-model";

export function buildProgressOverviewView(knowledge: KnowledgeView) {
  return {
    concepts: knowledge.concepts.map(({ concept, stage }) => ({
      id: concept.id,
      slug: concept.slug,
      title: concept.title,
      englishTitle: concept.englishTitle,
      stageId: stage.id,
      stageTitle: stage.title,
    })),
    stages: knowledge.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      contentStatus: stage.contentStatus,
      publishedConceptCount: stage.publishedConceptCount,
    })),
  } as const;
}

export type ProgressOverviewView = ReturnType<typeof buildProgressOverviewView>;
