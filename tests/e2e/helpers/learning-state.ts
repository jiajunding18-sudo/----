import type { Page } from "@playwright/test";

import { contentManifest } from "../../../.generated/content-manifest";

const storageKey = "mv-learning-os:learning-state";
const timestamp = "2026-08-28T08:00:00.000Z";

export async function seedAllPublishedConceptsMastered(page: Page) {
  const trackGoals = Object.fromEntries(
    contentManifest.tracks.map(({ defaultGoal, id }) => [id, defaultGoal]),
  );
  const defaultAdvancedMaster = contentManifest.tracks.find(
    ({ defaultGoal, kind }) =>
      kind === "advanced-branch" && defaultGoal === "master",
  );
  const conceptProgress = Object.fromEntries(
    contentManifest.concepts
      .filter(({ publicationStatus }) => publicationStatus === "published")
      .map((concept) => {
        const criterionIds = concept.masteryCriteria
          .filter(({ required }) => required)
          .map(({ id }) => id);
        const evidenceId = `evidence.e2e.${concept.id}`;
        return [
          concept.id,
          {
            status: "mastered",
            note: "",
            favorite: false,
            updatedAt: timestamp,
            startedAt: timestamp,
            understoodAt: timestamp,
            firstMasteredAt: timestamp,
            lastMasteredAt: timestamp,
            evidence: [
              {
                id: evidenceId,
                conceptId: concept.id,
                criterionIds,
                kind: "exercise",
                title: `E2E ${concept.title} 完成证据`,
                note: "覆盖当前正式必需标准。",
                result: "passed",
                completedAt: timestamp,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            ],
            masteryConfirmation: {
              confirmedAt: timestamp,
              criterionIds,
              evidenceIds: [evidenceId],
              statementVersion: 1,
            },
          },
        ];
      }),
  );
  const contentVersion = [
    ...contentManifest.concepts.map(({ contentVersion }) => contentVersion),
    ...contentManifest.projects.map(({ contentVersion }) => contentVersion),
  ].toSorted((left, right) => left.localeCompare(right, "en")).at(-1);
  const envelope = {
    app: "machine-vision-learning-os",
    schemaVersion: 1,
    contentVersion: contentVersion ?? "content-schema-1",
    revision: 1,
    savedAt: timestamp,
    payload: {
      schemaVersion: 1,
      preferences: {
        focusedTrackIds: defaultAdvancedMaster ? [defaultAdvancedMaster.id] : [],
        trackGoals,
        weeklyTargetMinutes: 540,
        updatedAt: timestamp,
      },
      conceptProgress,
      projectProgress: {},
      stageCheckpoints: {},
      studyLogs: [],
    },
  };

  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    { key: storageKey, value: JSON.stringify(envelope) },
  );
}
