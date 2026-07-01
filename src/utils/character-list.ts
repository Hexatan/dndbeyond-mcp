import type { DdbClient } from "../api/client.js";
import { getUserId } from "../api/auth.js";
import { ENDPOINTS } from "../api/endpoints.js";
import type { DdbCampaign, DdbCampaignRosterCharacter, DdbCharacterListResponse } from "../types/api.js";
import { levenshteinDistance } from "./fuzzy-match.js";

const CHARACTER_LIST_CACHE_TTL = 5 * 60 * 1000;

export interface ListedCharacter {
  id: number;
  name: string;
  race: string;
  classes: string;
  level: number;
  campaignName: string | null;
}

export interface CharacterReference {
  id: number;
  name: string;
  campaignName: string | null;
}

export async function getOwnedCharacterList(
  client: DdbClient
): Promise<ListedCharacter[] | null> {
  const userId = await getUserId();
  if (userId == null) return null;

  const response = await client.get<DdbCharacterListResponse>(
    ENDPOINTS.character.list(userId),
    `characters:list:${userId}`,
    CHARACTER_LIST_CACHE_TTL
  );

  return (response.characters ?? []).map((character) => ({
    id: character.id,
    name: character.name,
    race: character.raceName,
    classes: character.classDescription,
    level: character.level,
    campaignName: character.campaignName,
  }));
}

export async function getCampaignCharacterRefs(
  client: DdbClient
): Promise<CharacterReference[]> {
  const campaigns = await client.get<DdbCampaign[]>(
    ENDPOINTS.campaign.list(),
    "campaigns",
    CHARACTER_LIST_CACHE_TTL
  );

  const characters: CharacterReference[] = [];
  for (const campaign of campaigns) {
    const campaignCharacters = await client.get<DdbCampaignRosterCharacter[]>(
      ENDPOINTS.campaign.characters(campaign.id),
      `campaign:${campaign.id}:characters`,
      CHARACTER_LIST_CACHE_TTL
    );
    characters.push(...campaignCharacters.map((character) => ({
      id: character.id,
      name: character.name,
      campaignName: campaign.name,
    })));
  }
  return characters;
}

export async function getAccessibleCharacterRefs(
  client: DdbClient
): Promise<CharacterReference[]> {
  const ownedCharacters = await getOwnedCharacterList(client);
  if (ownedCharacters !== null) {
    return ownedCharacters.map((character) => ({
      id: character.id,
      name: character.name,
      campaignName: character.campaignName,
    }));
  }
  return getCampaignCharacterRefs(client);
}

export async function findAccessibleCharacterByName(
  client: DdbClient,
  name: string
): Promise<number | null> {
  const characters = await getAccessibleCharacterRefs(client);
  const lowerName = name.toLowerCase();

  const exactMatch = characters.find((character) => character.name.toLowerCase() === lowerName);
  if (exactMatch) return exactMatch.id;

  const substringMatches = characters.filter((character) =>
    character.name.toLowerCase().includes(lowerName)
  );
  if (substringMatches.length === 1) return substringMatches[0].id;

  const fuzzyMatches = characters.filter((character) => {
    if (levenshteinDistance(lowerName, character.name.toLowerCase()) <= 3) return true;
    return character.name
      .split(/\s+/)
      .some((word) => levenshteinDistance(lowerName, word.toLowerCase()) <= 3);
  });
  return fuzzyMatches.length === 1 ? fuzzyMatches[0].id : null;
}

export function formatListedCharacter(character: ListedCharacter): string {
  const campaign = character.campaignName ?? "No campaign";
  return `ID: ${character.id} | ${character.name} - ${character.race} ${character.classes} (Level ${character.level}) - ${campaign}`;
}
