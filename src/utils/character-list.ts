import type { DdbClient } from "../api/client.js";
import { getUserId } from "../api/auth.js";
import { ENDPOINTS } from "../api/endpoints.js";
import type { DdbCharacterListResponse } from "../types/api.js";

const CHARACTER_LIST_CACHE_TTL = 5 * 60 * 1000;

export interface ListedCharacter {
  id: number;
  name: string;
  race: string;
  classes: string;
  level: number;
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

export function formatListedCharacter(character: ListedCharacter): string {
  const campaign = character.campaignName ?? "No campaign";
  return `ID: ${character.id} | ${character.name} - ${character.race} ${character.classes} (Level ${character.level}) - ${campaign}`;
}
