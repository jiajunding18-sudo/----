export interface ContentValidationIssue {
  readonly sourcePath: string;
  readonly fieldPath: string;
  readonly message: string;
  readonly entityId?: string;
  readonly slug?: string;
}

function compareIssues(
  left: ContentValidationIssue,
  right: ContentValidationIssue,
) {
  return (
    left.sourcePath.localeCompare(right.sourcePath, "en") ||
    left.fieldPath.localeCompare(right.fieldPath, "en") ||
    (left.entityId ?? "").localeCompare(right.entityId ?? "", "en") ||
    left.message.localeCompare(right.message, "zh-CN")
  );
}

function formatIssue(issue: ContentValidationIssue) {
  const identity = [
    issue.entityId ? `id=${issue.entityId}` : undefined,
    issue.slug ? `slug=${issue.slug}` : undefined,
  ]
    .filter((value) => value !== undefined)
    .join(" ");
  const identitySuffix = identity.length > 0 ? ` [${identity}]` : "";

  return `${issue.sourcePath}:${issue.fieldPath}${identitySuffix}: ${issue.message}`;
}

export class ContentValidationError extends Error {
  readonly issues: readonly ContentValidationIssue[];

  constructor(issues: readonly ContentValidationIssue[]) {
    const sortedIssues = [...issues].sort(compareIssues);
    super(
      `内容校验失败（${sortedIssues.length} 项）\n${sortedIssues
        .map(formatIssue)
        .join("\n")}`,
    );
    this.name = "ContentValidationError";
    this.issues = sortedIssues;
  }
}

export function throwIfContentIssues(
  issues: readonly ContentValidationIssue[],
) {
  if (issues.length > 0) {
    throw new ContentValidationError(issues);
  }
}
