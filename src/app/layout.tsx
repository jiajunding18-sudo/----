import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { LearningStoreProvider } from "@/features/progress/learning-store-provider";
import {
  getCurrentContentVersion,
  getProgressCatalog,
} from "@/lib/content/site-content";

import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "机器视觉 Learning OS",
  description: "私人定制的机器视觉长期学习系统。",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  const progressCatalog = getProgressCatalog();

  return (
    <html lang="zh-CN">
      <body>
        <LearningStoreProvider
          catalog={progressCatalog}
          contentVersion={getCurrentContentVersion()}
        >
          <AppShell>{children}</AppShell>
        </LearningStoreProvider>
      </body>
    </html>
  );
}
