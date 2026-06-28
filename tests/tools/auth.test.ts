import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/api/auth.js", () => ({
  isAuthenticated: vi.fn(),
  getCobaltToken: vi.fn(),
}));

import { isAuthenticated, getCobaltToken } from "../../src/api/auth.js";
import { checkAuth } from "../../src/tools/auth.js";

const client = { isAuthExpired: false } as unknown as Parameters<typeof checkAuth>[0];

function textOf(result: { content: Array<{ text: string }> }) {
  return result.content.map((b) => b.text).join("\n");
}

beforeEach(() => vi.clearAllMocks());

describe("checkAuth (liveness)", () => {
  it("reports not authenticated when there is no session", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    expect(textOf(await checkAuth(client))).toMatch(/^Not authenticated/);
    expect(getCobaltToken).not.toHaveBeenCalled();
  });

  it("reports authenticated when the cobalt-token exchange succeeds", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(getCobaltToken).mockResolvedValue("a-token");
    expect(textOf(await checkAuth(client))).toMatch(/^Authenticated/);
  });

  it("reports expired when the cobalt-token exchange throws", async () => {
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    vi.mocked(getCobaltToken).mockRejectedValue(new Error("Cobalt token exchange failed: 401"));
    expect(textOf(await checkAuth(client))).toMatch(/^Session expired/);
  });
});
