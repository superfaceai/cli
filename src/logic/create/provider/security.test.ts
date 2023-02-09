import { HttpScheme, SecurityType } from '@superfaceai/ast';
import inquirer from 'inquirer';

import { SecuritySchemeName, selectSecurity } from './security';

jest.mock('inquirer');

describe('Select security logic', () => {
  it('returns empty object when "none" security is selected', async () => {
    jest
      .spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ schema: SecuritySchemeName.NONE });

    await expect(
      selectSecurity('test', 'https://swapi.dev/api')
    ).resolves.toEqual({});
  });

  describe('when bearer security is selected', () => {
    it('returns correct scheme and values', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.BEARER_TOKEN });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'bearer',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BEARER,
        },
        value: expect.any(Object),
      });
    });
  });

  describe('when basic security is selected', () => {
    it('returns correct scheme and values', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.BASIC_AUTH });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'basic',
          type: SecurityType.HTTP,
          scheme: HttpScheme.BASIC,
        },
        value: expect.any(Object),
      });
    });
  });

  describe('when digest security is selected', () => {
    it('returns correct scheme and values', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.DIGEST });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'digest',
          type: SecurityType.HTTP,
          scheme: HttpScheme.DIGEST,
        },
        value: expect.any(Object),
      });
    });
  });

  describe('when api key security is selected', () => {
    it('returns correct scheme and values - header placement', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.API_KEY })
        .mockResolvedValueOnce({ value: 'header' })
        .mockResolvedValueOnce({ name: 'auth' });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'apiKey',
          in: 'header',
          type: SecurityType.APIKEY,
          name: 'auth',
        },
        value: expect.any(Object),
      });
    });

    it('returns correct scheme and values - body placement', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.API_KEY })
        .mockResolvedValueOnce({ value: 'body' })
        .mockResolvedValueOnce({ name: 'auth' });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'apiKey',
          in: 'body',
          type: SecurityType.APIKEY,
          name: 'auth',
        },
        value: expect.any(Object),
      });
    });

    it('returns correct scheme and values - query placement', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.API_KEY })
        .mockResolvedValueOnce({ value: 'query' })
        .mockResolvedValueOnce({ name: 'auth' });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'apiKey',
          in: 'query',
          type: SecurityType.APIKEY,
          name: 'auth',
        },
        value: expect.any(Object),
      });
    });

    it('returns correct scheme and values - path placement', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.API_KEY })
        .mockResolvedValueOnce({ value: 'path' })
        .mockResolvedValueOnce({ name: 'auth' });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'apiKey',
          in: 'path',
          type: SecurityType.APIKEY,
          name: 'auth',
        },
        value: expect.any(Object),
      });
    });

    it('returns correct scheme and values - undefined name', async () => {
      jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ schema: SecuritySchemeName.API_KEY })
        .mockResolvedValueOnce({ value: 'path' })
        .mockResolvedValueOnce({ name: undefined });

      await expect(
        selectSecurity('test', 'https://swapi.dev/api')
      ).resolves.toEqual({
        scheme: {
          id: 'apiKey',
          in: 'path',
          type: SecurityType.APIKEY,
        },
        value: expect.any(Object),
      });
    });
  });
});
