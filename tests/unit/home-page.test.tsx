import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPage from "@/app/page";
import { LearningStoreProvider } from "@/features/progress/learning-store-provider";
import {
  getCurrentContentVersion,
  getProgressCatalog,
} from "@/lib/content/site-content";

describe("DashboardPage", () => {
  it("hydration 后先展示正式 NextStep，再展示 Progress 总览与 Stage 进度", async () => {
    const { container } = render(
      <LearningStoreProvider
        catalog={getProgressCatalog()}
        contentVersion={getCurrentContentVersion()}
      >
        <DashboardPage />
      </LearningStoreProvider>,
    );

    expect(
      container.querySelector('[data-dashboard-next-step="loading"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Dashboard",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "当前没有正在学习的知识点。是否有可执行入口，以上方正式 NextStep 结果为准。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "下一步学习" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "计算机、文件与终端" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "「Pixel Lab：可复现的第一次图像读写实验」需要「计算机、文件与终端」达到已理解，这是当前项目尚缺少的能力。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("3–4 小时")).toBeInTheDocument();
    expect(
      screen.getByText(
        "能从两个不同工作目录定位同一文件，并正确解释所用绝对路径与相对路径。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "开始学习" }),
    ).toHaveAttribute("href", "/knowledge/computer-files-and-terminal");
    expect(screen.getByRole("heading", { name: "学习进度总览" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Stage 学习情况" }))
      .toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "浏览 8 个 Concept" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Pixel Lab/ })).toHaveLength(2);
    expect(screen.getAllByText("0 / 8")).toHaveLength(3);
    expect(screen.getAllByRole("heading", { name: "下一步学习" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "学习中" })).toBeInTheDocument();
    expect(screen.queryByText(/总进度/)).not.toBeInTheDocument();
  });
});
