import { join as joinPath } from 'path';
import { stderr, stdout } from 'stdout-stderr';

import { rimraf } from '../common/io';

describe.skip('Install CLI command', () => {
  const installDir = joinPath('fixtures', 'install');
  //   const playground = joinPath(installDir, 'playground');
  //   const registry = joinPath(installDir, 'registry');
  //   const fixture = {
  //     superJson: joinPath(playground, 'super.json'),
  //     localProfile1: joinPath(playground, 'my-scope', 'my-profile.supr'),
  //     localProfile2: joinPath(playground, 'my-profile.supr'),
  //     registryProfile1: joinPath(registry, 'my-scope', 'my-profile.supr'),
  //     registryProfile2: joinPath(registry, 'my-profile.supr'),
  //   };

  beforeEach(() => {
    stderr.start();
    stdout.start();
  });

  afterEach(async () => {
    stderr.stop();
    stdout.stop();

    await rimraf(installDir);
  });

  //   it('install all profiles from grid folder when no argument is specified', async () => {
  //   }, 20000);

  //   it('install profile specified by argument', async () => {
  //   }, 20000);
});
