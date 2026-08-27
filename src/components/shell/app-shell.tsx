import type { ReactNode } from "react";

import { DesktopSidebar } from "./desktop-sidebar";
import { TopBar } from "./top-bar";

interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <DesktopSidebar />
      <div className="min-h-screen md:pl-64">
        <TopBar />
        <main
          className="mx-auto w-full max-w-[92rem] px-5 py-10 sm:px-8 sm:py-12 lg:px-12 lg:py-14"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
