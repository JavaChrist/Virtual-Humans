import { test, expect } from "@playwright/test";
import {
  classifyExternalRequest,
  installNetworkBarrier,
} from "../helpers/network-barrier";
import { loginViaUi } from "../helpers/auth";

test.describe("barrière réseau E2E", () => {
  test("classifie et bloque les hosts providers", () => {
    expect(classifyExternalRequest("https://api.openai.com/v1/x")).toBeTruthy();
    expect(classifyExternalRequest("https://fal.ai/model")).toBeTruthy();
    expect(classifyExternalRequest("https://api.elevenlabs.io/v1")).toBeTruthy();
    expect(
      classifyExternalRequest("https://aicommandcenteros.app/import"),
    ).toBeTruthy();
    expect(classifyExternalRequest("https://xxxx.supabase.co/rest/v1")).toBeTruthy();
    expect(classifyExternalRequest("https://api.vercel.com/v13/deployments")).toBeTruthy();
    expect(
      classifyExternalRequest("https://example.com/file?X-Amz-Signature=abc123456789"),
    ).toBe("signed-url");
    expect(classifyExternalRequest("http://127.0.0.1:3000/api/login")).toBeNull();
    expect(classifyExternalRequest("http://localhost:54321/rest/v1")).toBeNull();
  });

  test("navigateur — aucune requête provider pendant login", async ({ page }) => {
    const barrier = await installNetworkBarrier(page);
    await loginViaUi(page);
    barrier.assertClean();
    expect(barrier.violations).toHaveLength(0);
  });
});
