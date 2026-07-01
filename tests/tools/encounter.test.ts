import { describe, expect, it, vi } from "vitest";
import {
  deleteEncounter,
  getEncounter,
  getEncounterConfig,
  listEncounters,
  updateEncounter,
} from "../../src/tools/encounter.js";
import type { DdbClient } from "../../src/api/client.js";

function createMockClient(response: unknown | unknown[], putResponse?: unknown): DdbClient {
  const responses = Array.isArray(response) ? [...response] : [response];
  return {
    getRaw: vi.fn(async () => responses.shift()),
    put: vi.fn().mockResolvedValue(putResponse),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as DdbClient;
}

const sampleEncounter = {
  id: "enc-1",
  name: "Goblin Ambush",
  inProgress: true,
  roundNum: 2,
  turnNum: 1,
  difficulty: 3,
  campaign: { id: 101, name: "Lost Mines" },
  monsters: [
    {
      groupId: "group-1",
      name: "Goblin",
      quantity: 3,
      currentHitPoints: 7,
      maximumHitPoints: 7,
      temporaryHitPoints: 0,
      initiative: 14,
    },
  ],
  groups: [{ id: "group-1", name: "Cave Mouth" }],
  players: [
    {
      id: 1001,
      name: "Thorin",
      level: 5,
      classByLine: "Fighter",
      currentHitPoints: 31,
      maximumHitPoints: 44,
      temporaryHitPoints: 5,
      initiative: 12,
    },
  ],
  manualEntries: [],
};

describe("encounter tools", () => {
  it("lists saved encounters with IDs", async () => {
    const client = createMockClient({ data: [sampleEncounter] });

    const result = await listEncounters(client);

    expect(result.content[0].text).toContain("# Saved Encounters (1)");
    expect(result.content[0].text).toContain("Goblin Ambush");
    expect(result.content[0].text).toContain("id: enc-1");
    expect(result.content[0].text).toContain("1 player");
    expect(result.content[0].text).toContain("3 monsters");
    expect(result.content[0].text).toContain("in progress, round 2, turn 1");
    expect(client.getRaw).toHaveBeenCalledWith(
      "https://encounter-service.dndbeyond.com/v1/encounters?skip=0&take=10",
      "encounters:0:10",
      expect.any(Number),
    );
  });

  it("lists encounters with pagination", async () => {
    const client = createMockClient({
      pagination: { total: 20 },
      data: [sampleEncounter],
    });

    const result = await listEncounters(client, { skip: 10, take: 5 });

    expect(result.content[0].text).toContain("# Saved Encounters (1 of 20)");
    expect(client.getRaw).toHaveBeenCalledWith(
      "https://encounter-service.dndbeyond.com/v1/encounters?skip=10&take=5",
      "encounters:10:5",
      expect.any(Number),
    );
  });

  it("handles an empty encounter list", async () => {
    const client = createMockClient({ data: [] });

    const result = await listEncounters(client);

    expect(result.content[0].text).toBe("No saved encounters found.");
  });

  it("gets encounter config", async () => {
    const client = createMockClient({ encounterLimit: 10, currentEncounterCount: 2 });

    const result = await getEncounterConfig(client);

    expect(result.content[0].text).toBe("Encounter count: 2/10");
    expect(client.getRaw).toHaveBeenCalledWith(
      "https://encounter-service.dndbeyond.com/v1/encounters/user-config",
      "encounters:user-config",
      expect.any(Number),
    );
  });

  it("gets encounter detail", async () => {
    const client = createMockClient({ editable: true, data: sampleEncounter });

    const result = await getEncounter(client, { encounterId: "enc-1" });
    const text = result.content[0].text;

    expect(text).toContain("# Goblin Ambush");
    expect(text).toContain("Campaign: Lost Mines");
    expect(text).toContain("Editable: yes");
    expect(text).toContain("## Players");
    expect(text).toContain("Thorin — Level 5 — Fighter — HP 31/44, Temp 5 — Init 12");
    expect(text).toContain("## Monsters");
    expect(text).toContain("Goblin — x3 — HP 7/7 — Init 14 (Cave Mouth)");
    expect(client.getRaw).toHaveBeenCalledWith(
      "https://encounter-service.dndbeyond.com/v1/encounters/enc-1",
      "encounter:enc-1",
      expect.any(Number),
    );
  });

  it("gets encounter detail by exact name", async () => {
    const client = createMockClient([
      { data: [{ id: "wrong", name: "Goblin Ambush 2" }, sampleEncounter] },
      { editable: true, data: sampleEncounter },
    ]);

    const result = await getEncounter(client, { encounterName: "goblin ambush" });

    expect(result.content[0].text).toContain("# Goblin Ambush");
    expect(client.getRaw).toHaveBeenNthCalledWith(
      2,
      "https://encounter-service.dndbeyond.com/v1/encounters/enc-1",
      "encounter:enc-1",
      expect.any(Number),
    );
  });

  it("gets encounter detail by partial name when exact name is absent", async () => {
    const client = createMockClient([
      { data: [sampleEncounter] },
      { editable: true, data: sampleEncounter },
    ]);

    const result = await getEncounter(client, { encounterName: "ambush" });

    expect(result.content[0].text).toContain("# Goblin Ambush");
  });

  it("does not guess when multiple encounters match a name", async () => {
    const client = createMockClient({
      data: [
        { id: "enc-1", name: "Goblin Ambush", monsters: [], players: [] },
        { id: "enc-2", name: "Goblin Ambush 2", monsters: [], players: [] },
      ],
    });

    const result = await getEncounter(client, { encounterName: "goblin" });
    const text = result.content[0].text;

    expect(text).toContain("Multiple encounters match");
    expect(text).toContain("id: enc-1");
    expect(text).toContain("id: enc-2");
    expect(client.getRaw).toHaveBeenCalledTimes(1);
  });

  it("reports when a name does not match", async () => {
    const client = createMockClient({ data: [sampleEncounter] });

    const result = await getEncounter(client, { encounterName: "dragon" });

    expect(result.content[0].text).toBe('Encounter named "dragon" not found.');
  });

  it("reports missing detail data", async () => {
    const client = createMockClient({});

    const result = await getEncounter(client, { encounterId: "missing" });

    expect(result.content[0].text).toBe('Encounter "missing" not found.');
  });

  it("updates encounter metadata with a full PUT", async () => {
    const client = createMockClient(
      { editable: true, data: { ...sampleEncounter } },
      { data: { ...sampleEncounter, name: "Renamed Ambush" } },
    );

    const result = await updateEncounter(client, {
      encounterId: "enc-1",
      name: "Renamed Ambush",
      description: "New description",
    });

    expect(result.content[0].text).toBe('Updated encounter "Renamed Ambush" (id: enc-1).');
    expect(client.put).toHaveBeenCalledWith(
      "https://encounter-service.dndbeyond.com/v1/encounters/enc-1",
      expect.objectContaining({
        id: "enc-1",
        name: "Renamed Ambush",
        description: "New description",
      }),
      expect.arrayContaining(["encounters:0:10", "encounters:0:100", "encounter:enc-1"]),
    );
  });

  it("rejects update without fields", async () => {
    const client = createMockClient({ editable: true, data: sampleEncounter });

    const result = await updateEncounter(client, { encounterId: "enc-1" });

    expect(result.content[0].text).toContain("Provide at least one field");
    expect(client.getRaw).not.toHaveBeenCalled();
  });

  it("blocks writes to read-only encounters", async () => {
    const client = createMockClient({ editable: false, data: sampleEncounter });

    const result = await updateEncounter(client, { encounterId: "enc-1", name: "Nope" });

    expect(result.content[0].text).toBe('Encounter "Goblin Ambush" is read-only.');
    expect(client.put).not.toHaveBeenCalled();
  });

  it("blocks writes to AboveVTT-managed encounters", async () => {
    const client = createMockClient({
      editable: true,
      data: { ...sampleEncounter, flavorText: "This encounter is maintained by AboveVTT and will be replaced." },
    });

    const result = await updateEncounter(client, { encounterId: "enc-1", name: "Nope" });

    expect(result.content[0].text).toContain("managed by AboveVTT");
    expect(client.put).not.toHaveBeenCalled();
  });

  it("deletes encounter only when confirmName matches", async () => {
    const client = createMockClient({ editable: true, data: sampleEncounter });

    const result = await deleteEncounter(client, { encounterId: "enc-1", confirmName: "Goblin Ambush" });

    expect(result.content[0].text).toBe('Deleted encounter "Goblin Ambush" (id: enc-1).');
    expect(client.delete).toHaveBeenCalledWith(
      "https://encounter-service.dndbeyond.com/v1/encounters/enc-1",
      undefined,
      expect.arrayContaining(["encounters:0:10", "encounters:0:100", "encounter:enc-1"]),
    );
  });

  it("requires delete confirmation by encounter name", async () => {
    const client = createMockClient({ editable: true, data: sampleEncounter });

    const result = await deleteEncounter(client, { encounterId: "enc-1", confirmName: "Wrong" });

    expect(result.content[0].text).toBe('To delete this encounter, set confirmName to "Goblin Ambush".');
    expect(client.delete).not.toHaveBeenCalled();
  });
});
