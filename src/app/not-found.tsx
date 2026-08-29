import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-3xl py-8">
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--color-accent)] uppercase">
        404 · Content not found
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">
        内容不存在
      </h1>
      <p className="mt-5 leading-7 text-[var(--color-muted)]">
        这个 Concept、Project 或 Resource 尚未发布、已更换地址，或者输入的链接不正确。
      </p>
      <nav aria-label="返回内容入口" className="mt-7 flex flex-wrap gap-4">
        <Link
          className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
          href="/knowledge/"
        >
          返回 Knowledge
        </Link>
        <Link
          className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
          href="/projects/"
        >
          返回 Projects
        </Link>
        <Link
          className="font-semibold text-[var(--color-accent)] underline underline-offset-4"
          href="/resources/"
        >
          返回 Resources
        </Link>
      </nav>
    </div>
  );
}
