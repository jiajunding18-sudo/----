import { test } from "@playwright/test";
import { auditStageExit } from "./stage-exit.shared";
test("Stage exit desktop: references, confirm/revoke, cycles, legacy, keyboard, axe", async ({ page }) => { await auditStageExit(page); });
