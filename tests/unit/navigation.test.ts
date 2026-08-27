import { describe, expect, it } from "vitest";

import {
  auxiliaryNavigation,
  isNavigationItemActive,
  primaryNavigation,
  resolveCurrentNavigationItem,
} from "@/components/shell/navigation";

describe("navigation contract", () => {
  it("保持五个一级导航的固定数量与顺序", () => {
    expect(primaryNavigation.map((item) => item.label)).toEqual([
      "Dashboard",
      "Roadmap",
      "Knowledge",
      "Projects",
      "Study Log",
    ]);
    expect(auxiliaryNavigation.map((item) => item.label)).toEqual([
      "Search",
      "Settings / Data",
    ]);
  });

  it("Dashboard 只精确匹配根路由", () => {
    expect(isNavigationItemActive("/", primaryNavigation[0])).toBe(true);
    expect(isNavigationItemActive("/roadmap/", primaryNavigation[0])).toBe(false);
  });

  it("父导航匹配自身及未来嵌套路由并容忍尾斜杠", () => {
    expect(isNavigationItemActive("/knowledge", primaryNavigation[2])).toBe(true);
    expect(isNavigationItemActive("/knowledge/", primaryNavigation[2])).toBe(true);
    expect(
      isNavigationItemActive("/knowledge/camera-calibration/", primaryNavigation[2]),
    ).toBe(true);
    expect(resolveCurrentNavigationItem("/settings/data/")?.label).toBe(
      "Settings / Data",
    );
  });
});
