export const Messages = {
  ['compile-profile']: (profile: string): string =>
    `Compiling profile ${profile}`,
  ['compile-map']: (profile: string, provider: string): string =>
    `Compiling map for profile ${profile} and provider ${provider}`,
};
