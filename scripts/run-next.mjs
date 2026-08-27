import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const nextArguments = process.argv.slice(2);

if (nextArguments.length === 0) {
  console.error("Expected a Next.js command, for example: dev, build, or typegen.");
  process.exit(1);
}

const nextCliPath = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const nextProcess = spawn(process.execPath, [nextCliPath, ...nextArguments], {
  env: {
    ...process.env,
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: "inherit",
});

nextProcess.on("error", (error) => {
  console.error("Unable to start Next.js:", error);
  process.exitCode = 1;
});

nextProcess.on("exit", (exitCode, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = exitCode ?? 1;
});
