import { capitalize, startCase } from './format';

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
});
