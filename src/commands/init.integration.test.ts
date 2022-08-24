import { EXTENSIONS } from '@superfaceai/ast';
import { join as joinPath } from 'path';

import { SUPER_PATH, SUPERFACE_DIR } from '../common/document';
import { access, exists, rimraf } from '../common/io';
import { messages } from '../common/messages';
import type { MockStd } from '../test/mock-std';
import { mockStd } from '../test/mock-std';
import Init from './init';

describe('Init CLI command', () => {
  const baseFixture = joinPath('fixtures', 'playgrounds');
  const testInitFolder = 'test';
  const testInitFolderPath = joinPath(baseFixture, testInitFolder);
  let stdout: MockStd;

  beforeEach(() => {
    stdout = mockStd();
    jest
      .spyOn(process['stdout'], 'write')
      .mockImplementation(stdout.implementation);
  });

  afterEach(async () => {
    jest.resetAllMocks();
    await rimraf(testInitFolderPath);
  });

  it('initializes base folder', async () => {
    await expect(Init.run([testInitFolderPath])).resolves.toBeUndefined();

    expect(stdout.output).toContain(
      messages.mkdir('fixtures/playgrounds/test/superface')
    );

    expect(stdout.output).toContain(
      messages.initSuperJson('fixtures/playgrounds/test/superface/super.json')
    );

    await expect(
      exists(joinPath(testInitFolderPath, SUPER_PATH))
    ).resolves.toEqual(true);
    await expect(
      exists(joinPath(testInitFolderPath, SUPERFACE_DIR))
    ).resolves.toEqual(true);
  });

  it('initializes base folder with quiet mode', async () => {
    await expect(Init.run([testInitFolderPath, '-q'])).resolves.toBeUndefined();

    expect(stdout.output).not.toContain(
      messages.mkdir('fixtures/playgrounds/test/superface')
    );

    await expect(
      exists(joinPath(testInitFolderPath, SUPER_PATH))
    ).resolves.toEqual(true);
    await expect(
      exists(joinPath(testInitFolderPath, SUPERFACE_DIR))
    ).resolves.toEqual(true);
  });

  it('initilizes base folder with specified profiles', async () => {
    const profile1 = {
      id: 'my-profile@1.0.0',
      scope: undefined,
      name: 'my-profile',
      version: '1.0.0',
    };
    const profile2 = {
      id: 'my-scope/my-profile@1.0.0',
      scope: 'my-scope',
      name: 'my-profile',
      version: '1.0.0',
    };

    await expect(
      Init.run([testInitFolderPath, '--profiles', profile1.id, profile2.id])
    ).resolves.toBeUndefined();

    const expectedFiles = [
      `${profile1.name}${EXTENSIONS.profile.source}`,
      profile2.scope,
      joinPath(profile2.scope, `${profile2.name}${EXTENSIONS.profile.source}`),
    ];

    expect(stdout.output).toContain(
      messages.createProfile(
        'my-profile@1.0.0',
        'fixtures/playgrounds/test/my-profile.supr'
      )
    );

    expect(stdout.output).toContain(
      messages.createProfile(
        'my-scope/my-profile@1.0.0',
        'fixtures/playgrounds/test/my-scope/my-profile.supr'
      )
    );

    await expect(
      Promise.all(
        expectedFiles.map(file => access(joinPath(testInitFolderPath, file)))
      )
    ).resolves.toBeDefined();

    // TODO: check for super.json
  });

  it('initilizes base folder with specified providers', async () => {
    await expect(
      Init.run([testInitFolderPath, '--providers', 'twilio', 'osm'])
    ).resolves.toBeUndefined();

    // TODO: check for super.json
  });
});
