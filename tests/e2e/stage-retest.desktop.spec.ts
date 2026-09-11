import { test } from '@playwright/test';
import { stage2Retest,noRetest,stage0Retest } from './stage-retest.shared';
test('Stage 2 retention full lifecycle desktop',async({page})=>stage2Retest(page));
test('Stage 1A explicit no-retest desktop',async({page})=>noRetest(page));
test('Stage 0 waiting and probes desktop',async({page})=>stage0Retest(page));
