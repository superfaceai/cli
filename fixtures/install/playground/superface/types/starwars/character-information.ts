import { typeHelper } from '@superfaceai/sdk';
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
export const starwarsCharacterInformation = {
    "starwars/character-information": {
        "RetrieveCharacterInformation": typeHelper<RetrieveCharacterInformationInput, RetrieveCharacterInformationResult>()
    }
};
