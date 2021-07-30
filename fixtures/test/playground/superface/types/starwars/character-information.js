"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.starwarsCharacterInformation = void 0;
var one_sdk_1 = require("@superfaceai/one-sdk");
var profile = {
    /**
     * Retrieve Character Info
     * Retrieve information about a Star Wars character.
     **/
    "RetrieveCharacterInformation": one_sdk_1.typeHelper()
};
exports.starwarsCharacterInformation = {
    "starwars/character-information": profile
};
