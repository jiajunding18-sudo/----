import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPage from "@/app/page";
import { LearningStoreProvider } from "@/features/progress/learning-store-provider";
import {
  getCurrentContentVersion,
  getProgressCatalog,
} from "@/lib/content/site-content";

describe("DashboardPage", () => {
  it("展示真实 Stage 0 静态结构与分离的三类本地进度", async () => {
    render(
      <LearningStoreProvider
        catalog={getProgressCatalog()}
        contentVersion={getCurrentContentVersion()}
      >
        <DashboardPage />
      </LearningStoreProvider>,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Dashboard",
      }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Stage 0 本地进度")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "浏览 8 个 Concept" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pixel Lab/ })).toBeInTheDocument();
    expect(screen.getAllByText("0 / 8")).toHaveLength(3);
    expect(
      screen.queryByRole("heading", { name: /今日推荐/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
