import { SuperJson } from '@superfaceai/one-sdk';
import { join as joinPath, resolve } from 'path';

import { mkdir, rimraf } from '../common/io';
import { setUpTempDir } from '../test/utils';
import { OutputStream } from './output-stream';
import { resolveSuperfaceRelatedPath } from './path';

describe('Configure CLI command', () => {
  //File specific path
  const TEMP_PATH = joinPath('test', 'tmp');
  const CWD = process.cwd();
  let tempDir: string;
  const mockSuperJson = new SuperJson();
  let superJson: SuperJson;

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
      mockSuperJson.stringified
    );

    //Set up file inside superface directory
    await mkdir(joinPath('superface', 'second'));
    await OutputStream.writeOnce(
      joinPath('superface', 'second', 'profile.supr'),
      'content'
    );
  });
  beforeEach(async () => {
    superJson = (
      await SuperJson.load(joinPath('superface', 'super.json'))
    ).unwrap();
  });

  afterAll(async () => {
    process.chdir(CWD);
    await rimraf(tempDir);
  });

  describe('when resolving superface related path', () => {
    it('returns correct path for relative path to file outside superface directory', async () => {
      expect(
        resolveSuperfaceRelatedPath('./first/profile.supr', superJson)
      ).toEqual('../first/profile.supr');
    });
    it('returns correct path for absolute path to file outside superface directory', async () => {
      expect(
        resolveSuperfaceRelatedPath(resolve('./first/profile.supr'), superJson)
      ).toEqual('../first/profile.supr');
    });
    it('returns correct path for relative path to file inside superface directory', async () => {
      expect(
        resolveSuperfaceRelatedPath(
          './superface/second/profile.supr',
          superJson
        )
      ).toEqual('./second/profile.supr');
    });
    it('returns correct path for absolute path to file inside superface directory', async () => {
      expect(
        resolveSuperfaceRelatedPath(
          resolve('./superface/second/profile.supr'),
          superJson
        )
      ).toEqual('./second/profile.supr');
    });
  });
});
