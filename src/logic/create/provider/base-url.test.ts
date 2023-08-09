import inquirer from 'inquirer';

import { createUserError } from '../../../common/error';
import { selecetBaseUrl } from './base-url';

jest.mock('inquirer');

describe('Select base URL logic', () => {
  const userError = createUserError(false, false);

  it('returns base url', async () => {
    jest
      .spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ baseUrl: ' https://swapi.dev/api' });

    await expect(selecetBaseUrl('test', { userError })).resolves.toEqual(
      'https://swapi.dev/api'
    );
  });

  it('throws on invalid url', async () => {
    jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ baseUrl: '!iz:kl' });

    await expect(selecetBaseUrl('test', { userError })).rejects.toThrow(
      'Invalid URL "!iz:kl": TypeError [ERR_INVALID_URL]: Invalid URL'
    );
  });
});
