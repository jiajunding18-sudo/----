export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <main
        className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16 sm:px-10 lg:px-16"
        id="main-content"
        tabIndex={-1}
      >
        <section aria-labelledby="page-title" className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold tracking-[0.12em] text-[var(--color-accent)] uppercase">
            Phase 1A · Engineering Foundation
          </p>
          <h1
            className="text-4xl leading-tight font-semibold tracking-[-0.035em] text-[var(--color-ink)] sm:text-5xl lg:text-6xl"
            id="page-title"
          >
            机器视觉 Learning OS
          </h1>
          <p className="mt-7 text-lg leading-8 text-[var(--color-muted)] sm:text-xl">
            Phase 1A 工程骨架已就绪。当前仅提供可运行、可测试、可静态导出的基础环境，正式学习功能将在后续阶段逐步实现。
          </p>
          <dl className="mt-10 grid gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-2">
            <div className="bg-[var(--color-surface)] p-5">
              <dt className="text-sm text-[var(--color-muted)]">当前范围</dt>
              <dd className="mt-2 font-medium text-[var(--color-ink)]">
                项目初始化与工程验证
              </dd>
            </div>
            <div className="bg-[var(--color-surface)] p-5">
              <dt className="text-sm text-[var(--color-muted)]">下一阶段</dt>
              <dd className="mt-2 font-medium text-[var(--color-ink)]">
                Phase 1B 应用壳层
              </dd>
            </div>
          </dl>
        </section>
      </main>
    </>
  );
}
