import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPage from "@/app/page";

describe("DashboardPage", () => {
  it("展示真实 Stage 0 静态结构而不伪造学习状态", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Dashboard",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/尚未记录个人学习状态/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "浏览 8 个 Concept" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pixel Lab/ })).toBeInTheDocument();
    expect(screen.queryByText(/掌握进度：/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /今日推荐/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
