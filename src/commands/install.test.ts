import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import {
  getProfileDocument,
  META_FILE,
  parseSuperJson,
  SUPERFACE_DIR,
  writeSuperJson,
} from '../common/document';
import { exists, rimraf } from '../common/io';
import Install from './install';

describe('Install CLI command', () => {
  const WORKING_DIR = joinPath(
    'fixtures',
    'install',
    'playground',
    SUPERFACE_DIR
  );

  const REGISTRY_DIR = joinPath('..', '..', 'registry');

  const fixture = {
    superJson: META_FILE,
    local: {
      profile: joinPath('grid', 'my-profile.supr'),
      scope: joinPath('grid', 'my-scope'),
      profileWithScope: joinPath('grid', 'my-scope', 'my-profile.supr'),
    },
    registry: {
      profile101: joinPath(REGISTRY_DIR, 'my-profile@1.0.1.supr'),
      profileWithScope101: joinPath(
        REGISTRY_DIR,
        'my-scope',
        'my-profile@1.0.1.supr'
      ),
      profile200: joinPath(REGISTRY_DIR, 'my-profile@2.0.0.supr'),
      profileWithScope200: joinPath(
        REGISTRY_DIR,
        'my-scope',
        'my-profile@2.0.0.supr'
      ),
    },
  };

  const profileName = 'my-profile';
  const profileWithScopeName = 'my-scope/my-profile';

  // restart super.json to initial state
  async function restartSuperJson() {
    await writeSuperJson(
      fixture.superJson,
      {
        profiles: {
          [profileWithScopeName]: {
            file: 'file:grid/my-scope/my-profile.supr',
            version: '1.0.0',
          },
        },
        providers: {},
      },
      { force: true }
    );
  }

  beforeAll(async () => {
    // change cwd to /fixtures/install for establishing registry mock
    process.chdir(WORKING_DIR);

    await restartSuperJson();

    await rimraf(fixture.local.profile);
    await rimraf(fixture.local.scope);
  });

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(async () => {
    await restartSuperJson();

    stderr.stop();
    stdout.stop();
  });

  afterAll(async () => {
    await rimraf(fixture.local.profile);
    await rimraf(fixture.local.scope);

    // change cwd back
    process.chdir('../../../../');
  });

  describe('when profile id is not specified', () => {
    afterEach(async () => {
      await rimraf(fixture.local.scope);
    });

    it('installs profiles in super.json', async () => {
      const expectedProfilesCount = 1;

      {
        await expect(
          Install.run([`${profileWithScopeName}@2.0.0`])
        ).resolves.toBeUndefined();

        const { profiles } = await parseSuperJson(fixture.superJson);
        const local = await getProfileDocument(fixture.local.profileWithScope);
        const registry = await getProfileDocument(
          fixture.registry.profileWithScope200
        );

        const localName = local.header.scope
          ? `${local.header.scope}/${local.header.name}`
          : local.header.name;

        expect(local).toEqual(registry);

        expect(profiles[localName]).toEqual({
          file: 'file:grid/my-scope/my-profile.supr',
          version: '2.0.0',
        });

        expect(Object.values(profiles).length).toEqual(expectedProfilesCount);
      }

      {
        await expect(Install.run([])).resolves.toBeUndefined();
        expect(await exists(fixture.local.profileWithScope)).toBe(true);

        const local = await getProfileDocument(fixture.local.profileWithScope);
        const registry = await getProfileDocument(
          fixture.registry.profileWithScope200
        );

        expect(local).toEqual(registry);
      }
    });
  });

  describe('when profile id is specified', () => {
    it('installs specified profile into super.json', async () => {
      const expectedProfilesCount = 1;

      {
        await expect(
          Install.run([`${profileWithScopeName}@1.0.1`])
        ).resolves.toBeUndefined();

        const { profiles } = await parseSuperJson(fixture.superJson);
        const local = await getProfileDocument(fixture.local.profileWithScope);
        const registry = await getProfileDocument(
          fixture.registry.profileWithScope101
        );

        const localName = local.header.scope
          ? `${local.header.scope}/${local.header.name}`
          : local.header.name;

        expect(local).toEqual(registry);

        expect(profiles[localName]).toEqual({
          file: 'file:grid/my-scope/my-profile.supr',
          version: '1.0.1',
        });

        expect(Object.values(profiles).length).toEqual(expectedProfilesCount);
      }

      {
        await expect(
          Install.run([`${profileWithScopeName}@2.0`, '-f'])
        ).resolves.toBeUndefined();

        const { profiles } = await parseSuperJson(fixture.superJson);
        const local = await getProfileDocument(fixture.local.profileWithScope);
        const registry = await getProfileDocument(
          fixture.registry.profileWithScope200
        );

        const localName = local.header.scope
          ? `${local.header.scope}/${local.header.name}`
          : local.header.name;

        expect(local).toEqual(registry);

        expect(profiles[localName]).toEqual({
          file: 'file:grid/my-scope/my-profile.supr',
          version: '2.0.0',
        });

        expect(Object.values(profiles).length).toEqual(expectedProfilesCount);
      }

      {
        await expect(
          Install.run([`${profileName}@1.0.1`])
        ).resolves.toBeUndefined();

        const { profiles } = await parseSuperJson(fixture.superJson);
        const local = await getProfileDocument(fixture.local.profile);
        const registry = await getProfileDocument(fixture.registry.profile101);

        const localName = local.header.scope
          ? `${local.header.scope}/${local.header.name}`
          : local.header.name;

        expect(local).toEqual(registry);

        expect(profiles[localName]).toEqual({
          file: 'file:grid/my-profile.supr',
          version: '1.0.1',
        });

        expect(Object.values(profiles).length).toEqual(
          expectedProfilesCount + 1
        );
      }
    });
  });
});
