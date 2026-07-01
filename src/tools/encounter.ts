import { DdbClient } from "../api/client.js";
import { ENDPOINTS } from "../api/endpoints.js";

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

interface EncounterEntry {
  [key: string]: unknown;
  id: string;
  name: string;
  description?: string | null;
  flavorText?: string | null;
  inProgress?: boolean;
  roundNum?: number;
  turnNum?: number;
  difficulty?: number;
  status?: number;
  campaign?: { id?: number; name?: string } | null;
  monsters?: EncounterMonster[];
  groups?: Array<{ id: string; name: string }>;
  players?: EncounterPlayer[];
  manualEntries?: EncounterPlayer[];
}

interface EncounterMonster {
  groupId?: string | null;
  id?: number;
  uniqueId?: string;
  name?: string;
  quantity?: number;
  currentHitPoints?: number | null;
  temporaryHitPoints?: number | null;
  maximumHitPoints?: number | null;
  initiative?: number | null;
}

interface EncounterPlayer {
  id?: number | string;
  name?: string;
  userName?: string;
  level?: number;
  race?: string;
  classByLine?: string;
  currentHitPoints?: number | null;
  temporaryHitPoints?: number | null;
  maximumHitPoints?: number | null;
  initiative?: number | null;
}

interface EncounterListResponse {
  config?: EncounterUserConfig;
  pagination?: { take: number; skip: number; currentPage: number; pages: number; total: number };
  data?: EncounterEntry[];
}

interface EncounterDetailResponse {
  editable?: boolean;
  data?: EncounterEntry;
}

interface EncounterUserConfig {
  encounterLimit: number | null;
  currentEncounterCount: number;
}

type LoadedEncounter =
  | { ok: true; encounter: EncounterEntry; editable?: boolean }
  | { ok: false; error: string };

const ENCOUNTER_CACHE_TTL = 60_000;
const ABOVE_VTT_PREFIX = "This encounter is maintained by AboveVTT";

export async function listEncounters(
  client: DdbClient,
  params: { skip?: number; take?: number } = {},
): Promise<ToolResult> {
  const skip = Math.max(0, params.skip ?? 0);
  const take = Math.min(100, Math.max(1, params.take ?? 10));
  const response = await client.getRaw<EncounterListResponse>(
    ENDPOINTS.encounter.list(skip, take),
    encounterListCacheKey(skip, take),
    ENCOUNTER_CACHE_TTL,
  );
  const encounters = response.data ?? [];

  if (encounters.length === 0) {
    return { content: [{ type: "text", text: "No saved encounters found." }] };
  }

  const total = response.pagination?.total;
  const count = total !== undefined ? `${encounters.length} of ${total}` : encounters.length;
  const lines = [`# Saved Encounters (${count})`, ""];
  for (const encounter of encounters) {
    lines.push(formatEncounterSummary(encounter));
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
}

export async function getEncounterConfig(client: DdbClient): Promise<ToolResult> {
  const config = await client.getRaw<EncounterUserConfig>(
    ENDPOINTS.encounter.userConfig(),
    "encounters:user-config",
    ENCOUNTER_CACHE_TTL,
  );
  const limit = config.encounterLimit ?? "unlimited";
  return {
    content: [{ type: "text", text: `Encounter count: ${config.currentEncounterCount}/${limit}` }],
  };
}

export async function getEncounter(
  client: DdbClient,
  params: { encounterId?: string; encounterName?: string },
): Promise<ToolResult> {
  const loaded = await loadEncounter(client, params);
  if (!loaded.ok) return { content: [{ type: "text", text: loaded.error }] };

  return { content: [{ type: "text", text: formatEncounterDetail(loaded.encounter, loaded.editable) }] };
}

export async function updateEncounter(
  client: DdbClient,
  params: {
    encounterId?: string;
    encounterName?: string;
    name?: string;
    description?: string;
    flavorText?: string;
  },
): Promise<ToolResult> {
  if (params.name === undefined && params.description === undefined && params.flavorText === undefined) {
    return { content: [{ type: "text", text: "Provide at least one field to update: name, description, or flavorText." }] };
  }

  const loaded = await loadEncounter(client, params);
  if (!loaded.ok) return { content: [{ type: "text", text: loaded.error }] };
  const mutableError = mutableEncounterError(loaded.encounter, loaded.editable);
  if (mutableError) return { content: [{ type: "text", text: mutableError }] };

  if (params.name !== undefined) loaded.encounter.name = params.name;
  if (params.description !== undefined) loaded.encounter.description = params.description;
  if (params.flavorText !== undefined) loaded.encounter.flavorText = params.flavorText;

  const response = await client.put<EncounterDetailResponse>(
    ENDPOINTS.encounter.get(loaded.encounter.id),
    loaded.encounter,
    encounterCacheKeys(loaded.encounter.id),
  );
  const updated = response.data ?? loaded.encounter;
  return { content: [{ type: "text", text: `Updated encounter "${updated.name}" (id: ${updated.id}).` }] };
}

export async function deleteEncounter(
  client: DdbClient,
  params: { encounterId?: string; encounterName?: string; confirmName?: string },
): Promise<ToolResult> {
  const loaded = await loadEncounter(client, params);
  if (!loaded.ok) return { content: [{ type: "text", text: loaded.error }] };
  const mutableError = mutableEncounterError(loaded.encounter, loaded.editable);
  if (mutableError) return { content: [{ type: "text", text: mutableError }] };
  if (params.confirmName !== loaded.encounter.name) {
    return {
      content: [{ type: "text", text: `To delete this encounter, set confirmName to "${loaded.encounter.name}".` }],
    };
  }

  await client.delete<void>(
    ENDPOINTS.encounter.get(loaded.encounter.id),
    undefined,
    encounterCacheKeys(loaded.encounter.id),
  );
  return { content: [{ type: "text", text: `Deleted encounter "${loaded.encounter.name}" (id: ${loaded.encounter.id}).` }] };
}

async function loadEncounter(
  client: DdbClient,
  params: { encounterId?: string; encounterName?: string },
): Promise<LoadedEncounter> {
  const encounterId = params.encounterId ?? await resolveEncounterId(client, params.encounterName);
  if (!encounterId) {
    const error = params.encounterName?.trim()
      ? `Encounter named "${params.encounterName}" not found.`
      : "Provide encounterId or encounterName.";
    return { ok: false, error };
  }
  if (encounterId.startsWith("multiple:")) {
    return { ok: false, error: encounterId.slice("multiple:".length) };
  }

  const response = await client.getRaw<EncounterDetailResponse>(
    ENDPOINTS.encounter.get(encounterId),
    `encounter:${encounterId}`,
    ENCOUNTER_CACHE_TTL,
  );
  const encounter = response.data;

  if (!encounter) {
    return { ok: false, error: `Encounter "${encounterId}" not found.` };
  }

  return { ok: true, encounter, editable: response.editable };
}

async function resolveEncounterId(client: DdbClient, encounterName?: string): Promise<string | undefined> {
  if (!encounterName?.trim()) return undefined;

  const response = await client.getRaw<EncounterListResponse>(
    ENDPOINTS.encounter.list(0, 100),
    encounterListCacheKey(0, 100),
    ENCOUNTER_CACHE_TTL,
  );
  const encounters = response.data ?? [];
  const query = encounterName.trim().toLowerCase();
  const exact = encounters.filter((encounter) => encounter.name.toLowerCase() === query);
  const matches = exact.length > 0
    ? exact
    : encounters.filter((encounter) => encounter.name.toLowerCase().includes(query));

  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0].id;

  return `multiple:${["Multiple encounters match. Use encounterId:", ...matches.map(formatEncounterSummary)].join("\n")}`;
}

function formatEncounterSummary(encounter: EncounterEntry): string {
  const monsterCount = sumQuantity(encounter.monsters);
  const playerCount = encounter.players?.length ?? 0;
  const campaign = encounter.campaign?.name ? `, Campaign: ${encounter.campaign.name}` : "";
  const warning = isAboveVttEncounter(encounter) ? " [AboveVTT managed]" : "";
  return `- **${encounter.name}**${warning} (id: ${encounter.id}, ${countLabel(playerCount, "player")}, ${countLabel(monsterCount, "monster")}, ${combatState(encounter)}${campaign})`;
}

function formatEncounterDetail(encounter: EncounterEntry, editable?: boolean): string {
  const lines = [`# ${encounter.name}`, ""];
  lines.push(`ID: ${encounter.id}`);
  if (encounter.campaign?.name) lines.push(`Campaign: ${encounter.campaign.name}`);
  lines.push(`State: ${combatState(encounter)}`);
  if (isAboveVttEncounter(encounter)) lines.push("Warning: AboveVTT-managed encounter; writes are blocked.");
  if (encounter.difficulty !== undefined) lines.push(`Difficulty: ${encounter.difficulty}`);
  if (editable !== undefined) lines.push(`Editable: ${editable ? "yes" : "no"}`);

  if (encounter.players?.length) {
    lines.push("", "## Players");
    for (const player of encounter.players) {
      lines.push(`- ${formatParticipant(player)}`);
    }
  }

  if (encounter.monsters?.length) {
    const groupNames = new Map((encounter.groups ?? []).map((group) => [group.id, group.name]));
    lines.push("", "## Monsters");
    for (const monster of encounter.monsters) {
      const group = monster.groupId ? groupNames.get(monster.groupId) : undefined;
      lines.push(`- ${formatParticipant(monster)}${group ? ` (${group})` : ""}`);
    }
  }

  if (encounter.manualEntries?.length) {
    lines.push("", "## Manual Entries");
    for (const entry of encounter.manualEntries) {
      lines.push(`- ${formatParticipant(entry)}`);
    }
  }

  return lines.join("\n");
}

function formatParticipant(entry: EncounterMonster | EncounterPlayer): string {
  const pieces = [entry.name ?? "Unnamed"];
  if ("quantity" in entry && entry.quantity && entry.quantity > 1) pieces.push(`x${entry.quantity}`);
  if ("level" in entry && entry.level) pieces.push(`Level ${entry.level}`);
  if ("classByLine" in entry && entry.classByLine) pieces.push(entry.classByLine);
  const hp = formatHp(entry.currentHitPoints, entry.maximumHitPoints, entry.temporaryHitPoints);
  if (hp) pieces.push(hp);
  if (entry.initiative !== undefined && entry.initiative !== null) pieces.push(`Init ${entry.initiative}`);
  return pieces.join(" — ");
}

function formatHp(current?: number | null, max?: number | null, temp?: number | null): string {
  if (current == null && max == null && !temp) return "";
  const base = current != null || max != null ? `HP ${current ?? "?"}/${max ?? "?"}` : "";
  const tempText = temp ? `Temp ${temp}` : "";
  return [base, tempText].filter(Boolean).join(", ");
}

function combatState(encounter: EncounterEntry): string {
  if (!encounter.inProgress) return "not in progress";
  return `in progress, round ${encounter.roundNum ?? "?"}, turn ${encounter.turnNum ?? "?"}`;
}

function sumQuantity(monsters?: EncounterMonster[]): number {
  return (monsters ?? []).reduce((total, monster) => total + (monster.quantity ?? 1), 0);
}

function countLabel(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function mutableEncounterError(encounter: EncounterEntry, editable?: boolean): string | undefined {
  if (editable === false) return `Encounter "${encounter.name}" is read-only.`;
  if (isAboveVttEncounter(encounter)) return `Encounter "${encounter.name}" is managed by AboveVTT; writes are blocked.`;
  return undefined;
}

function isAboveVttEncounter(encounter: EncounterEntry): boolean {
  return typeof encounter.flavorText === "string" && encounter.flavorText.startsWith(ABOVE_VTT_PREFIX);
}

function encounterListCacheKey(skip: number, take: number): string {
  return `encounters:${skip}:${take}`;
}

function encounterCacheKeys(encounterId: string): string[] {
  return ["encounters", encounterListCacheKey(0, 10), encounterListCacheKey(0, 100), `encounter:${encounterId}`];
}
