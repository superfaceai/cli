"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addressGeocoding = void 0;
var one_sdk_1 = require("@superfaceai/one-sdk");
var profile = {
    /**
     * Geocode address
     * Geocode postal address into geographical coordinates (latitude and longitude)
     **/
    "Geocode": one_sdk_1.typeHelper(),
    /**
     * Reverse geocode
     * Decodes geographical coordinates (latitude and longitude) into postal addresses
     **/
    "ReverseGeocode": one_sdk_1.typeHelper()
};
exports.addressGeocoding = {
    "address/geocoding": profile
};
