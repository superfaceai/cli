import { join } from 'path';

import { formatPath } from './format';

describe('Format utils', () => {
  describe('formatPath', () => {
    const HOME_PATH = '/Users/admin';
    const APP_PATH = join(HOME_PATH, 'Documents/my-app');
    const SUPERFACE_DIR_PATH = join(APP_PATH, 'superface');
    const PROFILE_PATH = join(SUPERFACE_DIR_PATH, 'scope.name.profile');

    it('formats path to Profile from ~/', () => {
      expect(formatPath(PROFILE_PATH, HOME_PATH)).toEqual(
        'Documents/my-app/superface/scope.name.profile'
      );
    });

    it('formats path to Profile from app root', () => {
      expect(formatPath(PROFILE_PATH, APP_PATH)).toEqual(
        'superface/scope.name.profile'
      );
    });

    it('formats path to Profile from Superface directory', () => {
      expect(formatPath(PROFILE_PATH, SUPERFACE_DIR_PATH)).toEqual(
        'scope.name.profile'
      );
    });

    it('formats path to app root from Superface directory', () => {
      expect(formatPath(APP_PATH, SUPERFACE_DIR_PATH)).toEqual('..');
    });
  });
});
