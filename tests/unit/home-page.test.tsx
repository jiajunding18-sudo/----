import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("明确展示 Phase 1A 工程状态而不是正式 Dashboard", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "机器视觉 Learning OS",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Phase 1A 工程骨架已就绪/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("提供可聚焦的主要内容目标", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute(
      "href",
      "#main-content",
    );
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });
});
