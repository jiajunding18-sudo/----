import { startStaticServer } from "../../scripts/serve-static.mjs";

export default async function globalSetup() {
  const staticServer = await startStaticServer();

  return async () => {
    await staticServer.close();
  };
}
