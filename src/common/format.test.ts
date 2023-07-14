import { join } from 'path';

import { capitalize, formatPath, startCase } from './format';

describe('Format utils', () => {
  describe('when calling startCase', () => {
    it('formats string correctly', () => {
      expect(startCase('address ')).toEqual('Address');
      expect(startCase(' address/clean-address')).toEqual(
        'Address Clean Address'
      );
      expect(startCase('computer-vision/face-detection')).toEqual(
        'Computer Vision Face Detection'
      );
      expect(startCase('getUserName')).toEqual('Get User Name');
    });
  });

  describe('when calling capitalize', () => {
    it('formats string correctly', () => {
      expect(capitalize('address')).toEqual('Address');
      expect(capitalize('getUser')).toEqual('GetUser');
    });
  });

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
      expect(formatPath(APP_PATH, SUPERFACE_DIR_PATH)).toEqual(
        '..'
      );
    });
  });
});
