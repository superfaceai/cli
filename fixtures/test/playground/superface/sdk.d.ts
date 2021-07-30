export { StarwarsCharacterInformationProfile } from "./types/starwars/character-information";
export declare const SuperfaceClient: new () => import("@superfaceai/one-sdk/dist/client/client").TypedSuperfaceClient<{
    "starwars/character-information": {
        RetrieveCharacterInformation: [import("./types/starwars/character-information").StarwarsCharacterInformationRetrieveCharacterInformationInput, import("./types/starwars/character-information").StarwarsCharacterInformationRetrieveCharacterInformationResult];
    };
}>;
export declare type SuperfaceClient = InstanceType<typeof SuperfaceClient>;
