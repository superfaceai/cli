import { ProfileDocumentNode } from '@superfaceai/ast';
import { SuperJson } from '@superfaceai/one-sdk';
import * as fs from 'fs';
import { mocked } from 'ts-jest/utils';

import { EXTENSIONS } from '../common';
import { userError } from '../common/error';
import { exists, readdir, readFile } from '../common/io';
import {
  loadProfileAst,
  profileExists,
  providerExists,
} from './quickstart.utils';

jest.mock('../common/io');
describe('Quickstart logic', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  const profile = {
    profile: 'character-information',
    scope: 'starwars',
    version: '1.0.0',
  };

  const mockProfileAst: ProfileDocumentNode = {
    kind: 'ProfileDocument',
    header: {
      kind: 'ProfileHeader',
      scope: 'communication',
      name: 'send-email',
      version: { major: 1, minor: 1, patch: 0 },
      location: { line: 1, column: 1 },
      span: { start: 0, end: 100 },
      title: 'Send Email',
      description: 'Send one transactional email',
    },
    definitions: [
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'SendEmail',
        safety: 'unsafe',
        asyncResult: undefined,
        title: 'Send transactional email to one recipient',
        description: 'Email can contain text and/or html representation',
      },
      {
        kind: 'UseCaseDefinition',
        useCaseName: 'SendTemplatedEmail',
        safety: 'unsafe',
        asyncResult: undefined,
        title: 'Send templated transactional email to one recipient',
        description: 'Requires template defined on provider side.',
      },
      {
        kind: 'NamedModelDefinition',
        modelName: 'Error',
      },
    ],
    location: { line: 1, column: 1 },
    span: { start: 0, end: 775 },
  };
  describe('when loading profile AST', () => {
    it('returns ast if profile with scope and version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProfileAst));

      await expect(loadProfileAst(mockSuperJson, profile)).resolves.toEqual(
        mockProfileAst
      );

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/${profile.scope}/${profile.profile}@${profile.version}`
        )
      );
    });

    it('returns ast if profile with version exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProfileAst));

      await expect(
        loadProfileAst(mockSuperJson, {
          profile: profile.profile,
          version: profile.version,
        })
      ).resolves.toEqual(mockProfileAst);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/${profile.profile}@${profile.version}`)
      );
    });

    it('returns ast if profile with scope exists', async () => {
      const mockSuperJson = new SuperJson();
      const mockFiles: fs.Dirent[] = [
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.profile}${EXTENSIONS.profile.source}`,
        },
        {
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFIFO: () => false,
          isFile: () => true,
          isSocket: () => false,
          name: `${profile.profile}${EXTENSIONS.profile.build}`,
        },
      ];
      mocked(exists).mockResolvedValue(true);
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProfileAst));
      mocked(readdir).mockResolvedValue(mockFiles);

      await expect(
        loadProfileAst(mockSuperJson, {
          profile: profile.profile,
          scope: profile.scope,
        })
      ).resolves.toEqual(mockProfileAst);

      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(`grid/starwars`)
      );
      expect(exists).toHaveBeenCalledWith(
        expect.stringContaining(
          `grid/starwars/character-information${EXTENSIONS.profile.build}`
        )
      );
    });
    it('returns ast if profile with scope and version exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.scope}/${profile.profile}@${profile.version}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.profile}`]: {
            version: profile.version,
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProfileAst));

      await expect(loadProfileAst(mockSuperJson, profile)).resolves.toEqual(
        mockProfileAst
      );

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });

    it('returns undefined if profile with scope does not exists in super json file property', async () => {
      const testPath = `my/beloved/test/path/to/${profile.scope}/${profile.profile}`;
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.profile}`]: {
            version: profile.version,
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValue(false);
      mocked(readFile).mockResolvedValue(JSON.stringify(mockProfileAst));

      await expect(
        loadProfileAst(mockSuperJson, {
          profile: profile.profile,
          scope: profile.scope,
        })
      ).resolves.toBeUndefined();

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });

    it('throws error when loaded file is not valid', async () => {
      const testPath = `my/beloved/test/path/to/${profile.scope}/${profile.profile}@${profile.version}`;
      const coruptedDocument = { kind: 'yolo' };
      const mockSuperJson = new SuperJson({
        profiles: {
          [`${profile.scope}/${profile.profile}`]: {
            version: profile.version,
            file: testPath,
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      mocked(readFile).mockResolvedValue(JSON.stringify(coruptedDocument));

      await expect(loadProfileAst(mockSuperJson, profile)).rejects.toEqual(
        userError(
          `Profile ${profile.scope}/${profile.profile}@${
            profile.version
          } loaded from ${mockSuperJson.resolvePath(
            testPath
          )} is not valid ProfileDocumentNode`,
          1
        )
      );

      expect(exists).toHaveBeenCalledWith(expect.stringContaining(testPath));
    });
  });

  describe('when checking that profile already exists', () => {
    it('returns true if source file exists', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(true);

      await expect(
        profileExists(mockSuperJson, {
          profile: 'character-information',
          scope: 'starwars',
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = new SuperJson();
      mocked(exists).mockResolvedValue(false);

      await expect(
        profileExists(mockSuperJson, {
          profile: 'character-information',
          scope: 'starwars',
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });

    it('returns true if there is correct file property', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, {
          scope: 'communication',
          profile: 'send-email',
          version: '1.0.0',
        })
      ).resolves.toEqual(true);

      expect(exists).toHaveBeenCalledTimes(2);
    });

    it('returns false if there is different file property', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });
      mocked(exists).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await expect(
        profileExists(mockSuperJson, {
          scope: 'vcs',
          profile: 'pull-request',
          version: '1.0.0',
        })
      ).resolves.toEqual(false);

      expect(exists).toHaveBeenCalledTimes(1);
    });
  });

  describe('when checking that provider already exists', () => {
    it('returns true if provider is defined in super.json', async () => {
      const mockSuperJson = new SuperJson({
        profiles: {
          ['communication/send-email']: {
            file: 'some/path',
            providers: {
              sendgrid: {},
            },
          },
        },
        providers: {
          sendgrid: {
            security: [],
          },
        },
      });

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(true);
    });

    it('returns false if source file does not exist', async () => {
      const mockSuperJson = new SuperJson();

      expect(providerExists(mockSuperJson, 'sendgrid')).toEqual(false);
    });
  });
});
