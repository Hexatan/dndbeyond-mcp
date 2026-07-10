import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  COMPENDIUM_DOWNLOAD_USAGE,
  parseCompendiumArgs,
  runCompendiumDownload,
} from "../../src/scripts/download-compendium.js";

describe("parseCompendiumArgs", () => {
  it("uses the default directory under the user's home", () => {
    expect(parseCompendiumArgs([], "/home/tester")).toEqual({
      help: false,
      outputDir: "/home/tester/.dndbeyond-mcp/compendium",
      fresh: false,
    });
  });

  it("resolves a custom output directory", () => {
    expect(parseCompendiumArgs(["--output", "./local-compendium"]).outputDir)
      .toBe(resolve("./local-compendium"));
  });

  it("enables an explicit fresh download", () => {
    expect(parseCompendiumArgs(["--fresh"], "/home/tester").fresh).toBe(true);
  });

  it.each([
    { args: ["--output"], message: "--output requires a path" },
    { args: ["--output", "--help"], message: "--output requires a path" },
    { args: ["--output", "/one", "--output", "/two"], message: "--output may only be specified once" },
    { args: ["--fresh", "--fresh"], message: "--fresh may only be specified once" },
    { args: ["--unknown"], message: "Unknown argument: --unknown" },
    { args: ["positional"], message: "Unknown argument: positional" },
  ])("rejects invalid arguments: $message", ({ args, message }) => {
    expect(() => parseCompendiumArgs(args)).toThrow(message);
  });
});

describe("runCompendiumDownload", () => {
  it("prints help without starting a download", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await runCompendiumDownload(["--help"]);
      expect(log).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith(COMPENDIUM_DOWNLOAD_USAGE);
    } finally {
      log.mockRestore();
    }
  });
});
