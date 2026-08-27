import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPage from "@/app/page";

describe("DashboardPage", () => {
  it("展示真实的 Dashboard 骨架而不伪造学习状态", () => {
    render(<DashboardPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Dashboard",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/应用壳层已建立/)).toBeInTheDocument();
    expect(screen.getByText(/不展示虚构学习数据/)).toBeInTheDocument();
    expect(screen.queryByText(/掌握进度：/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
