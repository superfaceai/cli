import { typeHelper, TypedProfile } from '@superfaceai/one-sdk';
/** Starwars **/
export interface RetrieveCharacterInformationInput {
    characterName?: unknown;
}
/** Starwars **/
export interface RetrieveCharacterInformationResult {
    height?: unknown;
    weight?: unknown;
    yearOfBirth?: unknown;
}
export const profile = {
    "RetrieveCharacterInformation": typeHelper<RetrieveCharacterInformationInput, RetrieveCharacterInformationResult>()
};
export type StarwarsCharacterInformationProfile = TypedProfile<typeof profile>;
export const starwars/character-information = {
    "starwars/character-information": profile
};
