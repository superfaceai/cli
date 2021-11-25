import { SuperJson } from '@superfaceai/one-sdk';
import inquirer from 'inquirer';
import { mocked } from 'ts-jest/utils';
import { MockLogger } from '..';

import { constructProviderSettings } from '../common/document';
import { OutputStream } from '../common/output-stream';
import { generateSpecifiedProfiles, initSuperface } from '../logic/init';
import { CommandInstance } from '../test/utils';
// import { MockStd, mockStd } from '../test/mock-std';
import Init from './init';

//Mock init logic
jest.mock('../logic/init', () => ({
  initSuperface: jest.fn(),
  generateSpecifiedProfiles: jest.fn(),
}));

//Mock inquirer
jest.mock('inquirer');

describe('Init CLI command', () => {
  let logger: MockLogger;
  let instance: Init;

  describe('when running init command', () => {
    beforeEach(async () => {
      logger = new MockLogger();
      instance = CommandInstance(Init);
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    const mockPath = 'test';

    it('initializes superface with prompt', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(generateSpecifiedProfiles).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ profiles: 'first@1.0.0 second@1.0.0' })
        .mockResolvedValueOnce({ providers: 'twilio tyntec' });

      await expect(
        instance.execute({
          logger,
          flags: { profiles: [], providers: [], prompt: true },
          args: { name: mockPath },
        })
      ).resolves.toBeUndefined();

      expect(initSuperface).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledWith(
        {
          appPath: mockPath,
          initialDocument: {
            providers: constructProviderSettings(['twilio', 'tyntec']),
          },
        },
        expect.anything()
      );

      expect(promptSpy).toHaveBeenCalledTimes(2);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        new SuperJson({}).stringified
      );
    });

    it('initializes superface with invalid profiles and providers', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(generateSpecifiedProfiles).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      const promptSpy = jest
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ profiles: 'first second@1.0.0' })
        .mockResolvedValueOnce({ providers: 'twilio t7!c' });

      await expect(
        instance.execute({
          logger,
          flags: { profiles: [], providers: [], prompt: true },
          args: { name: mockPath },
        })
      ).resolves.toBeUndefined();

      expect(initSuperface).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledWith(
        {
          appPath: mockPath,
          initialDocument: {
            providers: constructProviderSettings(['twilio']),
          },
        },
        expect.anything()
      );

      expect(promptSpy).toHaveBeenCalledTimes(2);

      expect(writeOnceSpy).toHaveBeenCalledTimes(1);
      expect(writeOnceSpy).toHaveBeenCalledWith(
        '',
        new SuperJson({}).stringified
      );
    });

    it('initializes superface without prompt', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(generateSpecifiedProfiles).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      const promptSpy = jest.spyOn(inquirer, 'prompt');

      await expect(
        instance.execute({
          logger,
          flags: { profiles: [], providers: [] },
          args: { name: mockPath },
        })
      ).resolves.toBeUndefined();

      expect(initSuperface).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledWith(
        {
          appPath: mockPath,
          initialDocument: {
            providers: constructProviderSettings([]),
          },
        },
        expect.anything()
      );

      expect(promptSpy).toHaveBeenCalledTimes(0);

      expect(writeOnceSpy).toHaveBeenCalledTimes(0);
    });

    it('initializes superface with quiet flag', async () => {
      mocked(initSuperface).mockResolvedValue(new SuperJson({}));
      mocked(generateSpecifiedProfiles).mockResolvedValue(undefined);
      const writeOnceSpy = jest
        .spyOn(OutputStream, 'writeOnce')
        .mockResolvedValue(undefined);

      const promptSpy = jest.spyOn(inquirer, 'prompt');

      await expect(
        instance.execute({
          logger,
          flags: { profiles: [], providers: [], quiet: true },
          args: { name: mockPath },
        })
      ).resolves.toBeUndefined();

      expect(initSuperface).toHaveBeenCalledTimes(1);
      expect(initSuperface).toHaveBeenCalledWith(
        {
          appPath: mockPath,
          initialDocument: {
            providers: constructProviderSettings([]),
          },
        },
        expect.anything()
      );

      expect(promptSpy).toHaveBeenCalledTimes(0);

      expect(writeOnceSpy).toHaveBeenCalledTimes(0);
    });
  });
});
