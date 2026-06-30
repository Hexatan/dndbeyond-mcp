import { describe, expect, it } from "vitest";
import { getLiveClient } from "./setup.js";
import { ENDPOINTS } from "../../src/api/endpoints.js";
import type { DdbCampaign } from "../../src/types/api.js";
import type { DdbCharacter } from "../../src/types/character.js";
import { getCharacter, updateCurrency } from "../../src/tools/character.js";
import { getCampaignCharacters, listCampaigns } from "../../src/tools/campaign.js";
import { searchMonsters } from "../../src/tools/reference.js";
import { getOwnedCharacterList } from "../../src/utils/character-list.js";

const TARGET_CAMPAIGN = process.env.DDB_TEST_CAMPAIGN_NAME ?? "One Shot";

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchCampaigns(url: string): Promise<DdbCampaign[]> {
  const client = await getLiveClient();
  try {
    return await client.get<DdbCampaign[]>(
      url,
      `one-shot-campaigns:${url}:${Date.now()}`,
      1
    );
  } catch {
    return [];
  }
}

async function findTargetCampaign(): Promise<DdbCampaign | null> {
  const active = await fetchCampaigns(ENDPOINTS.campaign.list());
  const all = await fetchCampaigns(ENDPOINTS.campaign.userCampaigns());
  const campaigns = [...active, ...all];
  const target = normalizeName(TARGET_CAMPAIGN);
  return campaigns.find((campaign) => normalizeName(campaign.name) === target) ?? null;
}

async function findOwnedTargetCharacterId(): Promise<number | null> {
  const client = await getLiveClient();
  const envId = process.env.DDB_TEST_CHARACTER_ID;
  if (envId) return Number(envId);

  const owned = await getOwnedCharacterList(client);
  const target = normalizeName(TARGET_CAMPAIGN);
  const match = owned?.find((character) =>
    character.campaignName != null && normalizeName(character.campaignName) === target
  );
  return match?.id ?? null;
}

async function fetchCharacter(characterId: number): Promise<DdbCharacter> {
  const client = await getLiveClient();
  return client.get<DdbCharacter>(
    ENDPOINTS.character.get(characterId),
    `one-shot-character:${characterId}:${Date.now()}`,
    1
  );
}

describe("Live: One Shot new features", () => {
  it("should resolve One Shot through includeAll campaign tools", async () => {
    const client = await getLiveClient();
    const campaign = await findTargetCampaign();
    expect(campaign, `${TARGET_CAMPAIGN} campaign not found`).not.toBeNull();

    const campaigns = await listCampaigns(client, true);
    expect(normalizeName(campaigns.content[0].text)).toContain(normalizeName(campaign!.name));

    const roster = await getCampaignCharacters(client, {
      campaignId: campaign!.id,
      includeAll: true,
    });
    expect(roster.content[0].text).toContain(campaign!.name);
  });

  it("should fetch monster page 2 from live API", async () => {
    const client = await getLiveClient();
    const result = await searchMonsters(client, { name: "dragon", page: 2 });
    const text = result.content[0].text;

    expect(text).toContain("Monster Search Results");
    expect(text).toContain("page 2");
  });

  it("should render One Shot character speed and spellcasting without placeholder output", async () => {
    const client = await getLiveClient();
    const characterId = await findOwnedTargetCharacterId();
    expect(characterId, `No owned character found in ${TARGET_CAMPAIGN}`).not.toBeNull();

    const character = await fetchCharacter(characterId!);
    const result = await getCharacter(client, {
      characterId: characterId!,
      detail: "sheet",
    });
    const text = result.content[0].text;

    expect(text).toMatch(/Speed: [^\n]+/);
    expect(text).not.toContain("undefined");

    const hasSpells = Object.values(character.spells).some((list) => (list?.length ?? 0) > 0);
    if (hasSpells) {
      expect(text).toContain("Spell Save DC");
    }
  });

  it("should update GP through the current gold endpoint and roll back", async () => {
    const client = await getLiveClient();
    const characterId = await findOwnedTargetCharacterId();
    expect(characterId, `No owned character found in ${TARGET_CAMPAIGN}`).not.toBeNull();

    const before = await fetchCharacter(characterId!);
    const originalGp = before.currencies.gp;

    try {
      const updated = await updateCurrency(client, {
        characterId: characterId!,
        currency: "gp",
        amount: originalGp + 1,
      });
      expect(updated.content[0].text).toContain(`Set GP to ${originalGp + 1}`);

      const after = await fetchCharacter(characterId!);
      expect(after.currencies.gp).toBe(originalGp + 1);
    } finally {
      await updateCurrency(client, {
        characterId: characterId!,
        currency: "gp",
        amount: originalGp,
      });
    }

    const restored = await fetchCharacter(characterId!);
    expect(restored.currencies.gp).toBe(originalGp);
  });
});
