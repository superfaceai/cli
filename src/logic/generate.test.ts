import { parseProfile, Source } from '@superfaceai/parser';

import { generateTypesFile, generateTypingsForProfile } from './generate';

describe('Code Generation', () => {
  describe('SDK file', () => {
    it('should correctly generate SDK file from profile list', () => {
      const sdk = generateTypesFile(['sms/send-message', 'vcs/get-repos']);

      expect(sdk).toMatch('import { createTypedClient }');
      expect(sdk).toMatch('import { smsSendMessage }');
      expect(sdk).toMatch('import { vcsGetRepos }');
      expect(sdk).toMatch(/^const typeDefinitions/m);
      expect(sdk).toMatch('...smsSendMessage');
      expect(sdk).toMatch('...vcsGetRepos');
      expect(sdk).toMatch('SuperfaceClient');
    });
  });

  describe('profile file', () => {
    it('should correctly generate profile types from Profile', () => {
      const source = `name = "starwars/character-information"
      version = "1.0.0"

      usecase RetrieveCharacterInformation safe {
        input {
          characterName! string!
        }

        result {
          name! string!
          height string
          weight! string
          age number!
        }
      }`;
      const ast = parseProfile(new Source(source));

      const result = generateTypingsForProfile(ast);

      expect(result).toMatch(/import.*@superfaceai\/one-sdk/);
      expect(result).toMatch(
        'export type StarwarsCharacterInformationRetrieveCharacterInformationInput'
      );
      expect(result).toMatch(/characterName: string;?$/m);
      expect(result).toMatch(
        'export type StarwarsCharacterInformationRetrieveCharacterInformationResult'
      );
      expect(result).toMatch(
        'typeHelper<StarwarsCharacterInformationRetrieveCharacterInformationInput, StarwarsCharacterInformationRetrieveCharacterInformationResult>'
      );
      expect(result).toMatch(/name: string;?$/m);
      expect(result).toMatch(/height\?: string | null;?$/m);
      expect(result).toMatch(/weight: string | null;?$/m);
      expect(result).toMatch(/age\?: number;?$/m);
      expect(result).toMatch('export type StarwarsCharacterInformationProfile');
      expect(result).toMatch('export const starwarsCharacterInformation');
    });

    it('should correctly generate inline enum types', () => {
      const source = `name = "starwars/character-information"
      version = "1.0.0"

      usecase RetrieveCharacterInformation safe {
        input {
          characterName! string!
        }

        result {
          eyeColor enum {
            blue
            red
          }
        }
      }`;

      const ast = parseProfile(new Source(source));

      const result = generateTypingsForProfile(ast);

      expect(result).toMatch(/eyeColor\?: ['"]blue['"] | ['"]red['"];?$/m);
    });

    it('should correctly resolve named types', () => {
      const source = `name = "starwars/character-information"
      version = "1.0.0"

      usecase RetrieveCharacterInformation safe {
        input {
          characterName! string!
        }

        result {
          eyeColor Color!
          dimensions Dimensions
        }
      }
      
      model Color enum {
        blue
        red
      }

      model Dimensions {
        width string
        height string
      }`;

      const ast = parseProfile(new Source(source));

      const result = generateTypingsForProfile(ast);

      expect(result).toMatch(/eyeColor\?: ['"]blue['"] | ['"]red['"];?$/m);

      expect(result).toMatch(
        /dimensions\?: \{\s+width\?: string | null;?\s+height?: string | null;?\w+\};?\n/
      );
      expect(result).toMatch(/height\?: string | null;?$/m);
      expect(result).toMatch(/width\?: string | null;?$/m);
    });
  });
});
