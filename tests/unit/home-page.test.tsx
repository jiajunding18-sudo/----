import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPage from "@/app/page";
import { LearningStoreProvider } from "@/features/progress/learning-store-provider";
import {
  getCurrentContentVersion,
  getProgressCatalog,
} from "@/lib/content/site-content";

describe("DashboardPage", () => {
  it("展示正式 Progress 总览、继续学习空状态与分离的三类 Stage 进度", async () => {
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
    expect(
      await screen.findByText(
        "当前没有正在学习的知识点。这里不会自动指定下一项。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "学习进度总览" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stage 学习情况" }))
      .toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "浏览 8 个 Concept" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pixel Lab/ })).toBeInTheDocument();
    expect(screen.getAllByText("0 / 8")).toHaveLength(3);
    expect(
      screen.queryByRole("heading", { name: /今日推荐/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "学习中" })).toBeInTheDocument();
    expect(screen.queryByText(/总进度/)).not.toBeInTheDocument();
  });
});
