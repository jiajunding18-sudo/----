import { resources } from "../content/catalog/resources";

const REQUEST_TIMEOUT_MS = 15_000;

interface LinkCheckResult {
  readonly id: string;
  readonly ok: boolean;
  readonly status?: number;
  readonly finalUrl?: string;
  readonly message: string;
}

async function requestLink(url: string, method: "HEAD" | "GET") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "user-agent": "Machine-Vision-Learning-OS-Link-Check/1.0",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkLink(
  resource: (typeof resources)[number],
): Promise<LinkCheckResult> {
  if (!("url" in resource) || !resource.url) {
    return {
      id: resource.id,
      ok: resource.verification === "pending",
      message: "无 URL；保持 pending 并等待人工核验",
    };
  }

  try {
    let response = await requestLink(resource.url, "HEAD");
    if ([403, 405].includes(response.status)) {
      await response.body?.cancel();
      response = await requestLink(resource.url, "GET");
    }
    const result = {
      id: resource.id,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      message: response.ok ? "可达" : `HTTP ${response.status}`,
    } as const;
    await response.body?.cancel();
    return result;
  } catch (error) {
    return {
      id: resource.id,
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const results: LinkCheckResult[] = [];
  for (const resource of resources) {
    const result = await checkLink(resource);
    results.push(result);
    const status = result.ok ? "PASS" : "FAIL";
    const response = result.status ? ` HTTP ${result.status}` : "";
    const redirect =
      result.finalUrl && "url" in resource && result.finalUrl !== resource.url
        ? ` -> ${result.finalUrl}`
        : "";
    console.log(`${status} ${result.id}${response}${redirect} · ${result.message}`);
  }

  const verifiedFailures = results.filter((result) => {
    const resource = resources.find(({ id }) => id === result.id);
    return resource?.verification === "verified" && !result.ok;
  });
  if (verifiedFailures.length > 0) {
    console.error(
      `${verifiedFailures.length} 个 verified Resource 当前无法确认可达；请人工复核后更新 verification。`,
    );
    process.exitCode = 1;
  } else {
    console.log(`已检查 ${results.length} 个正式 Resource；verified URL 全部可达。`);
  }
}

void main();
