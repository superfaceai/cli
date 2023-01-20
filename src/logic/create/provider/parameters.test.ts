import inquirer from 'inquirer';

import { selectIntegrationParameters } from './parameters';

jest.mock('inquirer');

describe('Select integration parameters logic', () => {
  it('returns empty object when "skip setting up" is selected', async () => {
    jest.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ skip: true });

    await expect(selectIntegrationParameters('test')).resolves.toEqual({
      parameters: [],
      values: {},
    });
  });

  it('returns one integration parameter', async () => {
    jest
      .spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ name: 'version' })
      .mockResolvedValueOnce({ defaultValue: 'v1' })
      .mockResolvedValueOnce({ name: undefined });

    await expect(selectIntegrationParameters('test')).resolves.toEqual({
      parameters: [
        {
          name: 'version',
          default: 'v1',
        },
      ],
      values: expect.any(Object),
    });
  });

  it('returns two integration parameters', async () => {
    jest
      .spyOn(inquirer, 'prompt')
      .mockResolvedValueOnce({ name: 'version' })
      .mockResolvedValueOnce({ defaultValue: 'v1' })
      .mockResolvedValueOnce({ name: 'format' })
      .mockResolvedValueOnce({ defaultValue: undefined })
      .mockResolvedValueOnce({ name: undefined });

    await expect(selectIntegrationParameters('test')).resolves.toEqual({
      parameters: [
        {
          name: 'version',
          default: 'v1',
        },
        { name: 'format' },
      ],
      values: expect.any(Object),
    });
  });
});
