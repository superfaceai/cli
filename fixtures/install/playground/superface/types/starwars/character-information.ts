import { typeHelper, TypedProfile } from '@superfaceai/one-sdk';
export type RetrieveCharacterInformationInput = {
    characterName?: unknown;
};
export type RetrieveCharacterInformationResult = {
    height?: unknown;
    weight?: unknown;
    yearOfBirth?: unknown;
};
const profile = {
    /** Starwars **/
    "RetrieveCharacterInformation": typeHelper<RetrieveCharacterInformationInput, RetrieveCharacterInformationResult>()
};
export type StarwarsCharacterInformationProfile = TypedProfile<typeof profile>;
export const starwarsCharacterInformation = {
    "starwars/character-information": profile
};
