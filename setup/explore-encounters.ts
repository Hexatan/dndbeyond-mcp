/**
 * Focused D&D Beyond encounter endpoint explorer.
 *
 * Usage:
 *   npm run build
 *   node build/setup/explore-encounters.js
 *
 * Set DDB_HEADFUL=1 to watch the browser.
 */
import { chromium, type Page, type Response as PlaywrightResponse } from "playwright";
import { readFile, writeFile } from "node:fs/promises";

const CONFIG_PATH = `${process.env.HOME}/.dndbeyond-mcp/config.json`;
const OUTPUT_PATH = "setup/explored-encounter-endpoints.json";

interface AuthCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

interface CaptureEntry {
  source: string;
  method: string;
  url: string;
  path: string;
  status: number | null;
  resourceType: string;
  requestBodyKind?: string;
  responseContentType?: string;
  responseShape?: string;
}

interface DirectCheck {
  url: string;
  status: number | null;
  contentType?: string;
  responseShape?: string;
  error?: string;
}

const captured: CaptureEntry[] = [];
const directChecks: DirectCheck[] = [];
const seen = new Set<string>();
let currentSource = "init";

function isRelevant(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("dndbeyond.com")) return false;
    const lower = url.toLowerCase();
    return (
      lower.includes("encounter") ||
      lower.includes("combat") ||
      lower.includes("/api/") ||
      parsed.hostname.includes("encounter-service") ||
      parsed.hostname.includes("monster-service")
    );
  } catch {
    return false;
  }
}

function summarizeJson(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (!value || typeof value !== "object") return typeof value;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).slice(0, 12);
  const data = obj.data;
  if (Array.isArray(data)) return `object keys=[${keys.join(", ")}], data=array(${data.length})`;
  if (data && typeof data === "object") {
    return `object keys=[${keys.join(", ")}], dataKeys=[${Object.keys(data).slice(0, 12).join(", ")}]`;
  }
  return `object keys=[${keys.join(", ")}]`;
}

async function summarizeResponse(res: PlaywrightResponse): Promise<string | undefined> {
  const contentType = res.headers()["content-type"] ?? "";
  if (!contentType.includes("json")) return undefined;
  try {
    return summarizeJson(await res.json());
  } catch {
    return "json parse failed";
  }
}

function setupCapture(page: Page): void {
  page.on("request", (req) => {
    const url = req.url();
    if (!isRelevant(url)) return;

    const parsed = new URL(url);
    const key = `${currentSource} ${req.method()} ${url}`;
    if (seen.has(key)) return;
    seen.add(key);

    const entry: CaptureEntry = {
      source: currentSource,
      method: req.method(),
      url,
      path: parsed.pathname,
      status: null,
      resourceType: req.resourceType(),
    };

    if (req.postData()) {
      entry.requestBodyKind = "present";
    }

    captured.push(entry);
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (!isRelevant(url)) return;

    const entry = [...captured].reverse().find(
      (candidate) => candidate.url === url && candidate.status === null
    );
    if (!entry) return;

    entry.status = res.status();
    entry.responseContentType = res.headers()["content-type"];
    entry.responseShape = await summarizeResponse(res).catch(() => undefined);
  });
}

async function loadCookies(): Promise<AuthCookie[]> {
  const raw = await readFile(CONFIG_PATH, "utf8");
  const parsed = JSON.parse(raw) as { cookies?: AuthCookie[] };
  if (!parsed.cookies?.length) {
    throw new Error(`No cookies found at ${CONFIG_PATH}. Run npm run setup first.`);
  }
  return parsed.cookies;
}

async function getCobaltToken(cookies: AuthCookie[]): Promise<string | null> {
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  try {
    const response = await fetch("https://auth-service.dndbeyond.com/v1/cobalt-token", {
      method: "POST",
      headers: { Cookie: cookieHeader, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) return null;
    const json = await response.json() as { token?: string };
    return json.token ?? null;
  } catch {
    return null;
  }
}

async function gotoPage(page: Page, url: string): Promise<void> {
  currentSource = `page:${url}`;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  } catch {
    // Keep going; partial request capture is still useful.
  }
}

async function collectEncounterLinks(page: Page): Promise<string[]> {
  const hrefs = await page.locator("a[href]").evaluateAll((links) =>
    links
      .map((link) => (link as HTMLAnchorElement).href)
      .filter((href) => /encounter|combat/i.test(href))
  );

  return [...new Set(hrefs)]
    .filter((href) => !/delete|remove/i.test(href))
    .slice(0, 10);
}

async function runDirectChecks(token: string | null): Promise<void> {
  const candidates = [
    "https://www.dndbeyond.com/api/encounter-builder",
    "https://www.dndbeyond.com/api/encounter-builder/encounters",
    "https://www.dndbeyond.com/api/encounterbuilder",
    "https://www.dndbeyond.com/api/encounterbuilder/encounters",
    "https://www.dndbeyond.com/api/encounter",
    "https://www.dndbeyond.com/api/encounters",
    "https://www.dndbeyond.com/api/my-encounters",
    "https://www.dndbeyond.com/api/combat-tracker",
    "https://www.dndbeyond.com/api/combat-tracker/encounters",
    "https://encounter-service.dndbeyond.com/v1/Encounter",
    "https://encounter-service.dndbeyond.com/v1/Encounters",
    "https://encounter-service.dndbeyond.com/v1/Encounter/List",
  ];

  for (const url of candidates) {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token && url.includes("encounter-service.dndbeyond.com")) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { headers });
      const contentType = response.headers.get("content-type") ?? undefined;
      let responseShape: string | undefined;
      if (contentType?.includes("json")) {
        responseShape = summarizeJson(await response.json());
      }
      directChecks.push({ url, status: response.status, contentType, responseShape });
    } catch (error) {
      directChecks.push({
        url,
        status: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function main(): Promise<void> {
  const cookies = await loadCookies();
  const token = await getCobaltToken(cookies);

  const launchOptions = { headless: process.env.DDB_HEADFUL !== "1" };
  const browser = await chromium.launch(launchOptions).catch(() =>
    chromium.launch({ ...launchOptions, channel: "chrome" })
  );

  const context = await browser.newContext();
  await context.addCookies(cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain ?? ".dndbeyond.com",
    path: cookie.path ?? "/",
    expires: cookie.expires,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
  })));

  const page = await context.newPage();
  setupCapture(page);

  const pages = [
    "https://www.dndbeyond.com/my-encounters",
    "https://www.dndbeyond.com/encounter-builder",
    "https://www.dndbeyond.com/encounters",
    "https://www.dndbeyond.com/combat-tracker",
  ];

  for (const url of pages) {
    await gotoPage(page, url);
    for (const href of await collectEncounterLinks(page)) {
      await gotoPage(page, href);
    }
  }

  await browser.close();
  await runDirectChecks(token);

  const endpointSummary = [...new Map(
    captured.map((entry) => [`${entry.method} ${entry.path}`, `${entry.method} ${entry.path}`])
  ).values()].sort();

  await writeFile(OUTPUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    tokenAvailable: token != null,
    endpointSummary,
    captured,
    directChecks,
  }, null, 2));

  console.log(`Captured ${captured.length} relevant requests.`);
  console.log(`Unique relevant endpoints: ${endpointSummary.length}`);
  for (const endpoint of endpointSummary) console.log(endpoint);
  console.log("\nDirect checks:");
  for (const check of directChecks) console.log(`${check.status ?? "ERR"} ${check.url}`);
  console.log(`\nSaved to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
