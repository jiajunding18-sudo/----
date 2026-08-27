"use client";

import { useState } from "react";

type CopyState = "idle" | "copied" | "error";

export function CodeCopyButton({ code }: { readonly code: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  const label =
    copyState === "copied"
      ? "已复制"
      : copyState === "error"
        ? "复制失败"
        : "复制代码";

  return (
    <div className="code-copy-control">
      <button
        className="code-copy-button"
        onClick={copyCode}
        type="button"
      >
        {label}
      </button>
      <span aria-live="polite" className="sr-only">
        {copyState === "copied"
          ? "代码已复制到剪贴板"
          : copyState === "error"
            ? "代码复制失败，请手动选择代码"
            : ""}
      </span>
    </div>
  );
}
