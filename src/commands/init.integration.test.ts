import { EXTENSIONS } from '@superfaceai/ast';
import { join as joinPath } from 'path';

import {
  GRID_DIR,
  SUPER_PATH,
  SUPERFACE_DIR,
  TYPES_DIR,
} from '../common/document';
import { access, rimraf } from '../common/io';
import { messages } from '../common/messages';
import { MockStd, mockStd } from '../test/mock-std';
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

    const expectedFiles = [SUPER_PATH];

    const expectedDirectories = [SUPERFACE_DIR, TYPES_DIR, GRID_DIR];

    expect(stdout.output).toContain(
      messages.mkdir('fixtures/playgrounds/test/superface')
    );

    expect(stdout.output).toContain(
      messages.mkdir('fixtures/playgrounds/test/superface/grid')
    );
    expect(stdout.output).toContain(
      messages.initSuperJson('fixtures/playgrounds/test/superface/super.json')
    );
    expect(stdout.output).toContain(
      messages.mkdir('fixtures/playgrounds/test/superface/types')
    );

    await expect(
      Promise.all(
        expectedFiles.map(file => access(joinPath(testInitFolderPath, file)))
      )
    ).resolves.toBeDefined();

    await expect(
      Promise.all(
        expectedDirectories.map(dir =>
          access(joinPath(testInitFolderPath, dir))
        )
      )
    ).resolves.toBeDefined();
  });

  it('initializes base folder with quiet mode', async () => {
    await expect(Init.run([testInitFolderPath, '-q'])).resolves.toBeUndefined();

    const expectedFiles = [SUPER_PATH];

    const expectedDirectories = [SUPERFACE_DIR, TYPES_DIR, GRID_DIR];

    expect(stdout.output).not.toContain(
      messages.mkdir('fixtures/playgrounds/test/superface')
    );

    await expect(
      Promise.all(
        expectedFiles.map(file => access(joinPath(testInitFolderPath, file)))
      )
    ).resolves.toBeDefined();

    await expect(
      Promise.all(
        expectedDirectories.map(dir =>
          access(joinPath(testInitFolderPath, dir))
        )
      )
    ).resolves.toBeDefined();
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
      joinPath(GRID_DIR, `${profile1.name}${EXTENSIONS.profile.source}`),
      joinPath(GRID_DIR, profile2.scope),
      joinPath(
        GRID_DIR,
        profile2.scope,
        `${profile2.name}${EXTENSIONS.profile.source}`
      ),
    ];

    expect(stdout.output).toContain(
      messages.createProfile(
        'my-profile@1.0.0',
        'fixtures/playgrounds/test/superface/grid/my-profile.supr'
      )
    );

    expect(stdout.output).toContain(
      messages.createProfile(
        'my-scope/my-profile@1.0.0',
        'fixtures/playgrounds/test/superface/grid/my-scope/my-profile.supr'
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
