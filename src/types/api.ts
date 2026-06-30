export interface DdbApiResponse<T> {
  id: number;
  success: boolean;
  message: string;
  data: T;
  pagination: unknown | null;
}

export interface DdbErrorResponse {
  success: false;
  message: string;
  data: {
    serverMessage: string;
    errorCode: string;
  };
}

export interface DdbCampaignResponse {
  status: string;
  data: DdbCampaign[];
}

export interface DdbCampaign {
  id: number;
  name: string;
  dmId: number;
  dmUsername: string;
  playerCount: number;
  dateCreated: string;
  characters?: DdbCampaignCharacter2[];
}

export interface DdbCampaignCharacter {
  characterId: number;
  characterName: string;
  userId: number;
  username: string;
}

export interface DdbCampaignCharacter2 {
  id: number;
  name: string;
  userId: number;
  userName: string;
  avatarUrl: string;
  characterStatus: number;
  isAssigned: boolean;
}

export interface DdbCharacterListResponse {
  characterSlotLimit: number | null;
  canUnlockCharacters: boolean;
  characters: DdbCharacterListItem[];
}

export interface DdbCharacterListItem {
  id: number;
  level: number;
  name: string;
  status: number;
  statusSlug: string;
  isAssigned: boolean;
  classDescription: string;
  raceName: string;
  avatarUrl: string;
  backdropUrl: string;
  coverImageUrl: string;
  characterSecondaryInfo: string;
  campaignId: number | null;
  campaignName: string | null;
  createdDate: number;
  lastModifiedDate: number;
  isReady: boolean;
}
