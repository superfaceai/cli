import { join as joinPath, resolve } from 'path';

import { mkdir, rimraf } from '../common/io';
import { setUpTempDir } from '../test/utils';
import { OutputStream } from './output-stream';
import { resolveSuperfaceRelativePath } from './path';

describe('Configure CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  const CWD = process.cwd();
  let tempDir: string;
  const mockSuperJson = {};
  const superJsonPath = joinPath('superface', 'super.json');

  beforeAll(async () => {
    await mkdir(TEMP_PATH, { recursive: true });
    tempDir = await setUpTempDir(TEMP_PATH);
    process.chdir(tempDir);
    //Set up file outside superface directory
    await mkdir('first');
    await OutputStream.writeOnce(joinPath('first', 'profile.supr'), 'content');

    //Set up superface folder
    await mkdir('superface');
    await OutputStream.writeOnce(
      joinPath('superface', 'super.json'),
      JSON.stringify(mockSuperJson, undefined, 2)
    );

    //Set up file inside superface directory
    await mkdir(joinPath('superface', 'second'));
    await OutputStream.writeOnce(
      joinPath('superface', 'second', 'profile.supr'),
      'content'
    );
  });

  afterAll(async () => {
    process.chdir(CWD);
    await rimraf(tempDir);
  });

  describe('when resolving superface related path', () => {
    it('returns correct path for relative path to file outside superface directory', async () => {
      expect(
        resolveSuperfaceRelativePath(superJsonPath, './first/profile.supr')
      ).toEqual('../first/profile.supr');
    });
    it('returns correct path for absolute path to file outside superface directory', async () => {
      expect(
        resolveSuperfaceRelativePath(
          superJsonPath,
          resolve('./first/profile.supr')
        )
      ).toEqual('../first/profile.supr');
    });
    it('returns correct path for relative path to file inside superface directory', async () => {
      expect(
        resolveSuperfaceRelativePath(
          superJsonPath,
          './superface/second/profile.supr'
        )
      ).toEqual('./second/profile.supr');
    });
    it('returns correct path for absolute path to file inside superface directory', async () => {
      expect(
        resolveSuperfaceRelativePath(
          superJsonPath,
          resolve('./superface/second/profile.supr')
        )
      ).toEqual('./second/profile.supr');
    });
  });
});
