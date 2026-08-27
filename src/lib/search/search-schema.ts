import { z } from "zod";

export const searchKindSchema = z.enum([
  "concept",
  "project",
  "resource",
  "formula",
  "tool",
]);

export const searchDocumentSchema = z.strictObject({
  id: z.string().trim().min(1),
  kind: searchKindSchema,
  title: z.string().trim().min(1),
  englishTitle: z.string().trim().min(1).optional(),
  aliases: z.array(z.string().trim().min(1)),
  keywords: z.array(z.string().trim().min(1)),
  headings: z.array(z.string().trim().min(1)),
  goals: z.array(z.string().trim().min(1)),
  authorOrOrganization: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1),
  body: z.string(),
  tags: z.array(z.string().trim().min(1)),
  tokens: z.array(z.string().trim().min(1)),
  href: z.string().trim().min(1).optional(),
  external: z.boolean(),
  status: z.enum(["available", "verified", "pending", "broken"]),
  resourceType: z.string().trim().min(1).optional(),
  stageIds: z.array(z.string().trim().min(1)),
  stageTitles: z.array(z.string().trim().min(1)),
  trackIds: z.array(z.string().trim().min(1)),
  trackTitles: z.array(z.string().trim().min(1)),
  relatedTitles: z.array(z.string().trim().min(1)),
});

export const searchIndexSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    documents: z.array(searchDocumentSchema),
  })
  .superRefine(({ documents }, context) => {
    const ids = new Set<string>();
    documents.forEach((document, index) => {
      if (ids.has(document.id)) {
        context.addIssue({
          code: "custom",
          message: "SearchDocument ID 必须唯一",
          path: ["documents", index, "id"],
        });
      }
      ids.add(document.id);

      if (
        (document.kind === "concept" ||
          document.kind === "project" ||
          document.kind === "formula" ||
          document.kind === "tool") &&
        (!document.href || document.external)
      ) {
        context.addIssue({
          code: "custom",
          message: "站内搜索文档必须提供内部 href",
          path: ["documents", index, "href"],
        });
      }
    });
  });

export type SearchKind = z.infer<typeof searchKindSchema>;
export type SearchDocument = z.infer<typeof searchDocumentSchema>;
export type SearchIndex = z.infer<typeof searchIndexSchema>;
