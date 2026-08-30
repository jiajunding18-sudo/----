import { describe, expect, it } from "vitest";

import {
  calculateStudyStreak,
  createStudyLog,
  selectLastStudyDate,
  selectRecentStudyLogs,
  selectStudyLogSummary,
  selectTodayStudyMinutes,
  selectWeekStudyMinutes,
  sortStudyLogsByDateDescending,
  updateStudyLog,
  type StudyLogInput,
} from "@/features/study-log";
import type { StudyLog } from "@/types";

const createdAt = "2026-08-29T01:00:00.000Z";
const updatedAt = "2026-08-29T02:00:00.000Z";

function input(overrides: Partial<StudyLogInput> = {}): StudyLogInput {
  return {
    localDate: "2026-08-29",
    minutes: 45,
    conceptIds: ["tooling.computer-files"],
    projectIds: ["project.pixel-lab"],
    learned: "学习文件路径",
    blockers: "相对路径容易混淆",
    completed: "完成一个路径实验",
    tomorrowPlan: "复现文件读取失败",
    ...overrides,
  };
}

function log(
  id: string,
  localDate: string,
  minutes: number,
  created = createdAt,
): StudyLog {
  const result = createStudyLog(
    input({ localDate, minutes, conceptIds: [], projectIds: [] }),
    id,
    created,
  );
  if (!result.ok) throw new Error(result.message);
  return result.log;
}

describe("Study Log domain", () => {
  it("按正式字段创建日志，并清理文本与重复关联", () => {
    const result = createStudyLog(
      input({
        conceptIds: ["tooling.computer-files", "tooling.computer-files"],
        projectIds: ["project.pixel-lab", "project.pixel-lab"],
        learned: "  学习文件路径  ",
      }),
      "study-log.fixture",
      createdAt,
    );

    expect(result).toEqual({
      ok: true,
      changed: true,
      log: {
        id: "study-log.fixture",
        localDate: "2026-08-29",
        minutes: 45,
        conceptIds: ["tooling.computer-files"],
        projectIds: ["project.pixel-lab"],
        learned: "学习文件路径",
        blockers: "相对路径容易混淆",
        completed: "完成一个路径实验",
        tomorrowPlan: "复现文件读取失败",
        createdAt,
        updatedAt: createdAt,
      },
    });
  });

  it("拒绝非正整数时长与空学习内容", () => {
    expect(
      createStudyLog(input({ minutes: 0 }), "study-log.zero", createdAt),
    ).toMatchObject({ ok: false, code: "invalid-study-log" });
    expect(
      createStudyLog(
        input({ learned: "   " }),
        "study-log.empty",
        createdAt,
      ),
    ).toEqual({
      ok: false,
      code: "invalid-study-log",
      message: "请填写今天实际学习了什么。",
    });
  });

  it("编辑保留稳定 ID/创建时间，无变化时不制造写入", () => {
    const existing = log("study-log.edit", "2026-08-29", 45);
    expect(
      updateStudyLog(
        existing,
        input({ conceptIds: [], projectIds: [] }),
        updatedAt,
      ),
    ).toEqual({
      ok: true,
      changed: false,
      log: existing,
    });

    const changed = updateStudyLog(
      existing,
      input({
        minutes: 60,
        conceptIds: [],
        projectIds: [],
        completed: "完成两个实验",
      }),
      updatedAt,
    );
    expect(changed).toMatchObject({
      ok: true,
      changed: true,
      log: {
        id: "study-log.edit",
        minutes: 60,
        completed: "完成两个实验",
        createdAt,
        updatedAt,
      },
    });
  });

  it("按学习日期倒序，并以创建时间稳定打破同日并列", () => {
    const logs = [
      log("study-log.a", "2026-08-27", 20),
      log("study-log.b", "2026-08-29", 30, "2026-08-29T01:00:00.000Z"),
      log("study-log.c", "2026-08-29", 40, "2026-08-29T03:00:00.000Z"),
    ];
    expect(sortStudyLogsByDateDescending(logs).map(({ id }) => id)).toEqual([
      "study-log.c",
      "study-log.b",
      "study-log.a",
    ]);
    expect(selectRecentStudyLogs(logs, 2).map(({ id }) => id)).toEqual([
      "study-log.c",
      "study-log.b",
    ]);
    expect(selectLastStudyDate(logs)).toBe("2026-08-29");
  });

  it("今日和周统计只汇总用户填写分钟，并以周一为周起点", () => {
    const logs = [
      log("study-log.sun", "2026-08-23", 10),
      log("study-log.mon", "2026-08-24", 20),
      log("study-log.today-a", "2026-08-29", 30),
      log("study-log.today-b", "2026-08-29", 40),
      log("study-log.sun-next", "2026-08-30", 50),
      log("study-log.mon-next", "2026-08-31", 60),
    ];

    expect(selectTodayStudyMinutes(logs, "2026-08-29")).toBe(70);
    expect(selectWeekStudyMinutes(logs, "2026-08-29")).toBe(140);
    expect(selectWeekStudyMinutes(logs, "2026-08-31")).toBe(60);
    expect(selectStudyLogSummary(logs, "2026-08-29", 2)).toMatchObject({
      todayMinutes: 70,
      weekMinutes: 140,
      lastStudyDate: "2026-08-31",
    });
  });

  it("连续天数按存在有效日志的自然日去重，今天未记录时允许延续到昨天", () => {
    const logs = [
      log("study-log.26", "2026-08-26", 10),
      log("study-log.27-a", "2026-08-27", 20),
      log("study-log.27-b", "2026-08-27", 30),
      log("study-log.28", "2026-08-28", 40),
    ];
    expect(calculateStudyStreak(logs, "2026-08-29")).toBe(3);
    expect(calculateStudyStreak(logs, "2026-08-30")).toBe(0);
    expect(
      calculateStudyStreak(
        [...logs, log("study-log.29", "2026-08-29", 50)],
        "2026-08-29",
      ),
    ).toBe(4);
  });
});
