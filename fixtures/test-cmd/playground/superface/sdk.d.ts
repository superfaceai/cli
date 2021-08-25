export { StarwarsCharacterInformationProfile } from "./types/starwars/character-information";
export { AddressGeocodingProfile } from "./types/address/geocoding";
export declare const SuperfaceClient: new () => import("@superfaceai/one-sdk/dist/client/client").TypedSuperfaceClient<{
    "address/geocoding": {
        Geocode: [import("./types/address/geocoding").AddressGeocodingGeocodeInput, import("./types/address/geocoding").AddressGeocodingGeocodeResult];
        ReverseGeocode: [import("./types/address/geocoding").AddressGeocodingReverseGeocodeInput, import("./types/address/geocoding").AddressGeocodingReverseGeocodeResult];
    };
    "starwars/character-information": {
        RetrieveCharacterInformation: [import("./types/starwars/character-information").StarwarsCharacterInformationRetrieveCharacterInformationInput, import("./types/starwars/character-information").StarwarsCharacterInformationRetrieveCharacterInformationResult];
    };
}>;
export declare type SuperfaceClient = InstanceType<typeof SuperfaceClient>;
