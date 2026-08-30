import { studyLogSchema } from "@/lib/validation/progress-schemas";
import type { StudyLog } from "@/types";

export interface StudyLogInput {
  readonly localDate: string;
  readonly minutes: number;
  readonly conceptIds: readonly string[];
  readonly projectIds: readonly string[];
  readonly learned: string;
  readonly blockers: string;
  readonly completed: string;
  readonly tomorrowPlan: string;
}

export type StudyLogMutationResult =
  | {
      readonly ok: true;
      readonly changed: boolean;
      readonly log: StudyLog;
    }
  | {
      readonly ok: false;
      readonly code: "invalid-study-log";
      readonly message: string;
    };

export interface StudyLogSummary {
  readonly todayMinutes: number;
  readonly weekMinutes: number;
  readonly recentLogs: readonly StudyLog[];
  readonly lastStudyDate?: string;
  readonly streakDays: number;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function normalizeInput(input: StudyLogInput): StudyLogInput {
  return {
    ...input,
    conceptIds: uniqueIds(input.conceptIds),
    projectIds: uniqueIds(input.projectIds),
    learned: input.learned.trim(),
    blockers: input.blockers.trim(),
    completed: input.completed.trim(),
    tomorrowPlan: input.tomorrowPlan.trim(),
  };
}

function parseStudyLog(value: unknown): StudyLogMutationResult {
  const parsed = studyLogSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      code: "invalid-study-log",
      message: `学习记录未通过校验：${parsed.error.issues[0]?.message ?? "未知错误"}`,
    };
  }
  if (!parsed.data.learned) {
    return {
      ok: false,
      code: "invalid-study-log",
      message: "请填写今天实际学习了什么。",
    };
  }
  return { ok: true, changed: true, log: parsed.data };
}

export function createStudyLog(
  input: StudyLogInput,
  id: string,
  timestamp: string,
): StudyLogMutationResult {
  return parseStudyLog({
    ...normalizeInput(input),
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function updateStudyLog(
  existing: StudyLog,
  input: StudyLogInput,
  timestamp: string,
): StudyLogMutationResult {
  const parsed = parseStudyLog({
    ...normalizeInput(input),
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: timestamp,
  });
  if (!parsed.ok) return parsed;

  const comparableExisting = {
    localDate: existing.localDate,
    minutes: existing.minutes,
    conceptIds: existing.conceptIds,
    projectIds: existing.projectIds,
    learned: existing.learned,
    blockers: existing.blockers,
    completed: existing.completed,
    tomorrowPlan: existing.tomorrowPlan,
  };
  const comparableNext = {
    localDate: parsed.log.localDate,
    minutes: parsed.log.minutes,
    conceptIds: parsed.log.conceptIds,
    projectIds: parsed.log.projectIds,
    learned: parsed.log.learned,
    blockers: parsed.log.blockers,
    completed: parsed.log.completed,
    tomorrowPlan: parsed.log.tomorrowPlan,
  };

  return JSON.stringify(comparableExisting) === JSON.stringify(comparableNext)
    ? { ok: true, changed: false, log: existing }
    : parsed;
}

export function sortStudyLogsByDateDescending(
  logs: readonly StudyLog[],
): StudyLog[] {
  return logs.toSorted(
    (left, right) =>
      right.localDate.localeCompare(left.localDate, "en") ||
      right.createdAt.localeCompare(left.createdAt, "en") ||
      left.id.localeCompare(right.id, "en"),
  );
}

function localDateOrdinal(localDate: string): number {
  const [year, month, day] = localDate.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function startOfIsoWeekOrdinal(localDate: string): number {
  const ordinal = localDateOrdinal(localDate);
  const day = new Date(ordinal * 86_400_000).getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return ordinal - daysSinceMonday;
}

export function selectTodayStudyMinutes(
  logs: readonly StudyLog[],
  todayLocalDate: string,
): number {
  return logs
    .filter(({ localDate }) => localDate === todayLocalDate)
    .reduce((total, { minutes }) => total + minutes, 0);
}

export function selectWeekStudyMinutes(
  logs: readonly StudyLog[],
  todayLocalDate: string,
): number {
  const weekStart = startOfIsoWeekOrdinal(todayLocalDate);
  const weekEnd = weekStart + 6;
  return logs.reduce((total, log) => {
    const ordinal = localDateOrdinal(log.localDate);
    return ordinal >= weekStart && ordinal <= weekEnd
      ? total + log.minutes
      : total;
  }, 0);
}

export function selectRecentStudyLogs(
  logs: readonly StudyLog[],
  limit = 3,
): StudyLog[] {
  return sortStudyLogsByDateDescending(logs).slice(0, Math.max(0, limit));
}

export function selectLastStudyDate(
  logs: readonly StudyLog[],
): string | undefined {
  return sortStudyLogsByDateDescending(logs)[0]?.localDate;
}

export function calculateStudyStreak(
  logs: readonly StudyLog[],
  todayLocalDate: string,
): number {
  const studyDays = new Set(logs.map(({ localDate }) => localDateOrdinal(localDate)));
  const today = localDateOrdinal(todayLocalDate);
  let cursor = studyDays.has(today) ? today : today - 1;
  if (!studyDays.has(cursor)) return 0;

  let streak = 0;
  while (studyDays.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

export function selectStudyLogSummary(
  logs: readonly StudyLog[],
  todayLocalDate: string,
  recentLimit = 3,
): StudyLogSummary {
  return {
    todayMinutes: selectTodayStudyMinutes(logs, todayLocalDate),
    weekMinutes: selectWeekStudyMinutes(logs, todayLocalDate),
    recentLogs: selectRecentStudyLogs(logs, recentLimit),
    lastStudyDate: selectLastStudyDate(logs),
    streakDays: calculateStudyStreak(logs, todayLocalDate),
  };
}
