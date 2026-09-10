import { test } from "@playwright/test";
import { auditStageExit } from "./stage-exit.shared";
test("Stage exit 360px: lifecycle and no horizontal overflow", async ({ page }) => { await auditStageExit(page); });
