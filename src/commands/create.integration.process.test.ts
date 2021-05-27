import inquirer from 'inquirer';
import { getLocal } from 'mockttp';
import { join as joinPath } from 'path';

import { mkdir, rimraf } from '../common/io';
import {
  execCliWithInputs,
  mockResponsesForProfile,
  mockResponsesForProvider,
  setUpTempDir,
} from '../test/utils';

//Mock inquirer
jest.mock('inquirer');

const mockServer = getLocal();

describe('Create CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  const profileId = 'starwars/character-information';
  const profileVersion = '1.0.0';
  let tempDir: string;

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    await mockServer.start();
    await mockResponsesForProfile(mockServer, 'starwars/character-information');
    await mockResponsesForProvider(mockServer, 'swapi');
  });
  beforeEach(async () => {
    tempDir = await setUpTempDir(TEMP_PATH);
  });

  afterEach(async () => {
    await rimraf(tempDir);
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  describe('when configuring new provider', () => {
    it('creates profile with one usecase (with usecase name from cli)', async () => {
      jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ init: true });

      const result = await execCliWithInputs(
        tempDir,
        ['create', 'profile', profileId],
        mockServer.url,
        //Mock inquier input
        '\x0D'
      );

      expect(result.stdout).toMatch(
        `-> Created ${profileId}.supr (name = "${profileId}", version = "${profileVersion}")`
      );

      // result = await execCLI(
      //   tempDir,
      //   ['lint', 'starwars/character-information'],
      //   mockServer.url
      // );
      // expect(result.stdout).toMatch(
      //   'Detected 0 problems\n'
      // );

      // const superJson = (await SuperJson.load(joinPath(tempDir, 'superface', 'super.json'))).unwrap();

      // expect(superJson.document).toEqual({
      //   profiles: {
      //     [documentName]: {
      //       file: `../${documentName}.supr`,
      //     },
      //   },
      //   providers: {},
      // });
    }, 20000);
  });
});
