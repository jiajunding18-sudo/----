import { z } from "zod";

function formatIssuePath(path: readonly PropertyKey[]) {
  return path.length === 0 ? "<root>" : path.map(String).join(".");
}

export function parseDomainData<T>(
  schema: z.ZodType<T>,
  input: unknown,
  source: string,
): T {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  const details = result.error.issues
    .map((issue) => `${source}:${formatIssuePath(issue.path)}: ${issue.message}`)
    .join("\n");

  throw new Error(`领域数据校验失败\n${details}`);
}
