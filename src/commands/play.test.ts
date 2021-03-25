import { CLIError } from '@oclif/errors';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';

import Play from '../commands/play';
import { validateDocumentName } from '../common/document';
import {
  cleanPlayground,
  detectPlayground,
  executePlayground,
  initializePlayground,
  PlaygroundInstance,
} from '../logic/playground';

//Mock inquirer
jest.mock('inquirer');

//Mock document
jest.mock('../common/document');

//Mock logic
jest.mock('../logic/playground', () => ({
  ...jest.requireActual<Record<string, unknown>>('../logic/playground'),
  cleanPlayground: jest.fn(),
  detectPlayground: jest.fn(),
  executePlayground: jest.fn(),
  initializePlayground: jest.fn(),
}));
describe('Play CLI command', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when running play command', () => {
    const basepath = process.cwd();
    const mockPlaygroundInstance: PlaygroundInstance = {
      path: 'users/real/path/to/test-playground',
      name: 'first',
      profilePath: basepath + '/first/profile/file',
      providers: [
        {
          mapPath: basepath + '/first/profile/first/provider/file',
          name: 'first-provider',
        },
        {
          mapPath: basepath + '/first/profile/second/provider/file',
          name: 'second-provider',
        },
      ],
      scope: undefined,
    };

    it('initializes valid playground - use inputs from cli', async () => {
      const mockPath = 'test';
      mocked(validateDocumentName).mockReturnValue(true);
      mocked(initializePlayground).mockResolvedValue(undefined);
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      await expect(
        Play.run(['initialize', mockPath, '--providers', 'foo', 'bar'])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(0);
      expect(initializePlayground).toHaveBeenCalledTimes(1);
      expect(initializePlayground).toHaveBeenCalledWith(
        mockPath,
        {
          name: mockPath,
          providers: ['foo', 'bar'],
        },
        'pubs',
        {
          logCb: expect.anything(),
        }
      );
    });

    it('initializes valid playground - prompts for input', async () => {
      const mockPath = 'test';
      mocked(validateDocumentName).mockReturnValue(true);
      mocked(initializePlayground).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ providers: 'foo bar' });

      await expect(Play.run(['initialize', mockPath])).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(promptSpy).toHaveBeenCalledWith({
        name: 'providers',
        message: 'Input space separated list of providers to create',
        type: 'input',
        validate: expect.anything(),
      });
      expect(initializePlayground).toHaveBeenCalledTimes(1);
      expect(initializePlayground).toHaveBeenCalledWith(
        mockPath,
        {
          name: mockPath,
          providers: ['foo', 'bar'],
        },
        'pubs',
        {
          logCb: expect.anything(),
        }
      );
    });

    it('throw error on invalid document when initializing playground - prompts for input', async () => {
      const mockPath = 'test';
      mocked(validateDocumentName).mockReturnValue(false);
      mocked(initializePlayground).mockResolvedValue(undefined);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ providers: 'foo bar' });

      await expect(Play.run(['initialize', mockPath])).rejects.toEqual(
        new CLIError('The playground name must be a valid slang identifier')
      );

      expect(promptSpy).toHaveBeenCalledTimes(0);

      expect(initializePlayground).toHaveBeenCalledTimes(0);
    });

    it('executes playground - use inputs from cli', async () => {
      const mockPath = 'test';
      mocked(executePlayground).mockResolvedValue(undefined);
      mocked(detectPlayground).mockResolvedValue([mockPlaygroundInstance]);
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      await expect(
        Play.run([
          'execute',
          mockPath,
          '--providers',
          'first-provider',
          'second-provider',
        ])
      ).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(0);
      expect(executePlayground).toHaveBeenCalledTimes(1);
      expect(executePlayground).toHaveBeenCalledWith(
        mockPlaygroundInstance,
        ['first-provider', 'second-provider'],
        { ast: 'never', npm: 'never', tsc: 'never' },
        {
          debugLevel: '*',
          logCb: expect.anything(),
        }
      );
    });

    it('executes playground - prompts for input', async () => {
      const mockPath = 'test';
      mocked(executePlayground).mockResolvedValue(undefined);
      mocked(detectPlayground).mockResolvedValue([mockPlaygroundInstance]);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({
          providers: ['first-provider', 'second-provider'],
        })
        .mockResolvedValue({ playground: 'first' });

      await expect(Play.run(['execute', mockPath])).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(promptSpy).toHaveBeenCalledWith({
        name: 'providers',
        message: 'Select a provider to execute',
        type: 'checkbox',
        choices: [{ name: 'first-provider' }, { name: 'second-provider' }],
        validate: expect.anything(),
      });
      expect(executePlayground).toHaveBeenCalledTimes(1);
      expect(executePlayground).toHaveBeenCalledWith(
        mockPlaygroundInstance,
        ['first-provider', 'second-provider'],
        { ast: 'never', npm: 'never', tsc: 'never' },
        {
          debugLevel: '*',
          logCb: expect.anything(),
        }
      );
    });

    it('throws error provider not found when executing exisitng playground', async () => {
      const mockPath = 'test';
      mocked(executePlayground).mockResolvedValue(undefined);
      mocked(detectPlayground).mockResolvedValue([mockPlaygroundInstance]);
      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({
          providers: ['different-provider', 'second-provider'],
        })
        .mockResolvedValue({ playground: 'first' });

      await expect(
        Play.run([
          'execute',
          mockPath,
          '--providers',
          'different-provider', //Different provider
          'second-provider',
        ])
      ).rejects.toEqual(
        new CLIError(
          'Provider "different-provider" not found for playground "users/real/path/to/test-playground"'
        )
      );

      expect(promptSpy).toHaveBeenCalledTimes(0);

      expect(executePlayground).toHaveBeenCalledTimes(0);
    });

    it('cleans playground', async () => {
      const mockPath = 'test';
      mocked(cleanPlayground).mockResolvedValue(undefined);
      mocked(detectPlayground).mockResolvedValue([mockPlaygroundInstance]);
      const promptSpy = jest.spyOn(inquirer, 'prompt');

      await expect(Play.run(['clean', mockPath])).resolves.toBeUndefined();

      expect(promptSpy).toHaveBeenCalledTimes(0);

      expect(cleanPlayground).toHaveBeenCalledTimes(1);
      expect(cleanPlayground).toHaveBeenCalledWith(
        mockPlaygroundInstance,
        expect.anything()
      );
    });
  });
});
