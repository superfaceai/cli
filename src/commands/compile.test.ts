import { CLIError } from '@oclif/errors';
import { MapDocumentNode, ProfileDocumentNode } from '@superfaceai/ast';
import { err, ok, SuperJson } from '@superfaceai/one-sdk';
import { SDKExecutionError } from '@superfaceai/one-sdk/dist/internal/errors';
import { mocked } from 'ts-jest/utils';

import { exists, readFile } from '../common/io';
import { Parser } from '../common/parser';
import { detectSuperJson } from '../logic/install';
import Compile from './compile';

//Mock install logic
jest.mock('../logic/install', () => ({
  detectSuperJson: jest.fn(),
}));

//Mock io
jest.mock('../common/io', () => ({
  readFile: jest.fn(),
  isDirectoryQuiet: jest.fn(),
  exists: jest.fn(),
}));

//Mock output stream
jest.mock('../common/output-stream');

jest.mock('@superfaceai/parser', () => ({
  ...jest.requireActual<Record<string, unknown>>('@superfaceai/parser'),
  parseMap: jest.fn(),
  parseProfile: jest.fn(),
}));

describe('Compile CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('running compile command', () => {
    const mockProfileContent = 'mock-profile-content';
    const mockMapContent = 'mock-map-content';

    const mockMapDocument: MapDocumentNode = {
      kind: 'MapDocument',
      header: {
        kind: 'MapHeader',
        profile: {
          name: 'different-test-profile',
          scope: 'some-map-scope',
          version: {
            major: 1,
            minor: 0,
            patch: 0,
          },
        },
        provider: 'test-profile',
      },
      definitions: [],
    };

    const mockProfileDocument: ProfileDocumentNode = {
      kind: 'ProfileDocument',
      header: {
        kind: 'ProfileHeader',
        name: 'test-profile',
        version: {
          major: 1,
          minor: 0,
          patch: 0,
        },
      },
      definitions: [],
    };
    it('throws error when super.json not found', async () => {
      mocked(detectSuperJson).mockResolvedValue(undefined);

      await expect(
        Compile.run([
          '--profileId',
          'starwars/character-information',
          '--profile',
        ])
      ).rejects.toEqual(
        new CLIError('Unable to compile, super.json not found')
      );
    });

    it('throws error when unable to load super.json', async () => {
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(err(new SDKExecutionError('test', [], [])));
      await expect(
        Compile.run([
          '--profileId',
          'starwars/character-information',
          '--profile',
        ])
      ).rejects.toEqual(new CLIError('Unable to load super.json: test'));
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error when invalid profile id is passed', async () => {
      const mockProfileId = 'starwars/8-L!';
      const mockSuperJson = new SuperJson();
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      await expect(
        Compile.run(['--profileId', mockProfileId, '--profile'])
      ).rejects.toEqual(
        new CLIError(
          'Invalid profile id: "8-L!" is not a valid lowercase identifier'
        )
      );
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error when profile not found in super.json', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockSuperJson = new SuperJson();
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Compile.run(['--profileId', mockProfileId, '--profile'])
      ).rejects.toEqual(
        new CLIError(`Profile id: "${mockProfileId}" not found in super.json`)
      );
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error when profile not locally linked in super.json', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            version: '1.0.0',
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      await expect(
        Compile.run(['--profileId', mockProfileId, '--profile'])
      ).rejects.toEqual(
        new CLIError(
          `Profile id: "${mockProfileId}" not locally linked in super.json`
        )
      );
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('throws error when profile file not found', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: 'some/file.supr',
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));
      mocked(exists).mockResolvedValue(false);

      await expect(
        Compile.run(['--profileId', mockProfileId, '--profile'])
      ).rejects.toEqual(
        new CLIError(
          `Path: "${mockSuperJson.resolvePath(
            'some/file.supr'
          )}" does not exist`
        )
      );
      expect(loadSpy).toHaveBeenCalledTimes(1);
    });

    it('parses the profile', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: 'some/file.supr',
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(readFile).mockResolvedValue(mockProfileContent);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileDocument);

      mocked(exists).mockResolvedValue(true);

      await expect(
        Compile.run(['--profileId', mockProfileId, '--profile'])
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileContent,
        mockSuperJson.resolvePath('some/file.supr'),
        {
          scope: 'starwars',
          profileName: 'character-information',
        },
        true
      );
    });

    it('throws on missing providerName', async () => {
      const mockProfileId = 'starwars/character-information';
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest.spyOn(SuperJson, 'load');

      mocked(readFile).mockResolvedValue(mockProfileContent);
      const parseProfileSpy = jest.spyOn(Parser, 'parseProfile');

      mocked(exists).mockResolvedValue(true);

      await expect(
        Compile.run(['--profileId', mockProfileId, '--profile', '--map'])
      ).rejects.toEqual(
        new CLIError(`--providerName= must also be provided when using --map=`)
      );

      expect(loadSpy).toHaveBeenCalledTimes(0);
      expect(parseProfileSpy).toHaveBeenCalledTimes(0);
    });

    it('throws on invalid providerName', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockProvider = '8!l%';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: 'some/file.supr',
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(readFile).mockResolvedValue(mockProfileContent);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileDocument);

      mocked(exists).mockResolvedValue(true);

      await expect(
        Compile.run([
          '--profileId',
          mockProfileId,
          '--profile',
          '--providerName',
          mockProvider,
          '--map',
        ])
      ).rejects.toEqual(
        new CLIError(`Invalid provider name: "${mockProvider}"`)
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileContent,
        mockSuperJson.resolvePath('some/file.supr'),
        {
          scope: 'starwars',
          profileName: 'character-information',
        },
        true
      );
    });

    it('throws when provider not found in super.json', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockProvider = 'swapi';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: 'some/file.supr',
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(readFile).mockResolvedValue(mockProfileContent);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileDocument);

      mocked(exists).mockResolvedValue(true);

      await expect(
        Compile.run([
          '--profileId',
          mockProfileId,
          '--profile',
          '--providerName',
          mockProvider,
          '--map',
        ])
      ).rejects.toEqual(
        new CLIError(
          `Provider: "${mockProvider}" not found in profile: "${mockProfileId}" in super.json`
        )
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileContent,
        mockSuperJson.resolvePath('some/file.supr'),
        {
          scope: 'starwars',
          profileName: 'character-information',
        },
        true
      );
    });

    it('throws when provider not locally linked in super.json', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockProvider = 'swapi';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: 'some/file.supr',
            providers: {
              [mockProvider]: {},
            },
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(readFile).mockResolvedValue(mockProfileContent);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileDocument);

      mocked(exists).mockResolvedValue(true);

      await expect(
        Compile.run([
          '--profileId',
          mockProfileId,
          '--profile',
          '--providerName',
          mockProvider,
          '--map',
        ])
      ).rejects.toEqual(
        new CLIError(
          `Provider: "${mockProvider}" not locally linked in super.json in profile: "${mockProfileId}"`
        )
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileContent,
        mockSuperJson.resolvePath('some/file.supr'),
        {
          scope: 'starwars',
          profileName: 'character-information',
        },
        true
      );
    });

    it('throws when map file not found', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockProvider = 'swapi';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: 'some/file.supr',
            providers: {
              [mockProvider]: {
                file: 'some/file.suma',
              },
            },
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(readFile).mockResolvedValue(mockProfileContent);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileDocument);

      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      await expect(
        Compile.run([
          '--profileId',
          mockProfileId,
          '--profile',
          '--providerName',
          mockProvider,
          '--map',
        ])
      ).rejects.toEqual(
        new CLIError(
          `Path: "${mockSuperJson.resolvePath(
            'some/file.suma'
          )}" does not exist`
        )
      );

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileContent,
        mockSuperJson.resolvePath('some/file.supr'),
        {
          scope: 'starwars',
          profileName: 'character-information',
        },
        true
      );
    });

    it('compiles map', async () => {
      const mockProfileId = 'starwars/character-information';
      const mockProvider = 'swapi';
      const mockSuperJson = new SuperJson({
        profiles: {
          [mockProfileId]: {
            file: 'some/file.supr',
            providers: {
              [mockProvider]: {
                file: 'some/file.suma',
              },
            },
          },
        },
      });
      mocked(detectSuperJson).mockResolvedValue('.');
      const loadSpy = jest
        .spyOn(SuperJson, 'load')
        .mockResolvedValue(ok(mockSuperJson));

      mocked(readFile)
        .mockResolvedValueOnce(mockProfileContent)
        .mockResolvedValueOnce(mockMapContent);
      const parseProfileSpy = jest
        .spyOn(Parser, 'parseProfile')
        .mockResolvedValue(mockProfileDocument);
      const parseMapSpy = jest
        .spyOn(Parser, 'parseMap')
        .mockResolvedValue(mockMapDocument);

      mocked(exists).mockResolvedValueOnce(true).mockResolvedValueOnce(true);

      await expect(
        Compile.run([
          '--profileId',
          mockProfileId,
          '--profile',
          '--providerName',
          mockProvider,
          '--map',
        ])
      ).resolves.toBeUndefined();

      expect(loadSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledTimes(1);
      expect(parseProfileSpy).toHaveBeenCalledWith(
        mockProfileContent,
        mockSuperJson.resolvePath('some/file.supr'),
        {
          scope: 'starwars',
          profileName: 'character-information',
        },
        true
      );

      expect(parseMapSpy).toHaveBeenCalledTimes(1);
      expect(parseMapSpy).toHaveBeenCalledWith(
        mockMapContent,
        mockSuperJson.resolvePath('some/file.suma'),
        {
          scope: 'starwars',
          providerName: mockProvider,
          profileName: 'character-information',
        },
        true
      );
    });
  });
});
