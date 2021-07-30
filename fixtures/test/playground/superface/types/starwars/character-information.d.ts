import { TypedProfile } from '@superfaceai/one-sdk';
export declare type StarwarsCharacterInformationRetrieveCharacterInformationInput = {
    /**
     * Character name
     * The character name to use when looking up character information
     **/
    characterName?: string | null;
};
export declare type StarwarsCharacterInformationRetrieveCharacterInformationResult = {
    /**
     * Height
     * The height of the character
     **/
    height?: string | null;
    /**
     * Weight
     * The weight of the character
     **/
    weight?: string | null;
    /**
     * Year of birth
     * The year of birth of the character
     **/
    yearOfBirth?: string | null;
};
declare const profile: {
    /**
     * Retrieve Character Info
     * Retrieve information about a Star Wars character.
     **/
    RetrieveCharacterInformation: [StarwarsCharacterInformationRetrieveCharacterInformationInput, StarwarsCharacterInformationRetrieveCharacterInformationResult];
};
export declare type StarwarsCharacterInformationProfile = TypedProfile<typeof profile>;
export declare const starwarsCharacterInformation: {
    "starwars/character-information": {
        /**
         * Retrieve Character Info
         * Retrieve information about a Star Wars character.
         **/
        RetrieveCharacterInformation: [StarwarsCharacterInformationRetrieveCharacterInformationInput, StarwarsCharacterInformationRetrieveCharacterInformationResult];
    };
};
export {};
