const normalizedHyphens = /[-_\u2010-\u2015]+/gu;

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(normalizedHyphens, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function segmentSearchText(value: string) {
  const normalized = normalizeSearchText(value);
  if (!normalized) {
    return [];
  }

  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  const segments = [...segmenter.segment(normalized)]
    .map(({ segment }) => segment.trim())
    .filter(
      (segment) =>
        /[\p{L}\p{N}]/u.test(segment) || /[+*/=<>]/u.test(segment),
    );

  return [...new Set([normalized, ...segments])];
}

export function buildSearchTokens(values: readonly string[]) {
  return [
    ...new Set(values.flatMap((value) => segmentSearchText(value))),
  ].sort((left, right) => left.localeCompare(right, "en"));
}
