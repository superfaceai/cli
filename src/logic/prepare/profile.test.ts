import { MockLogger } from '../../common';
import { createUserError } from '../../common/error';
import { OutputStream } from '../../common/output-stream';
import { ProfileId } from '../../common/profile';
import { complete } from '../../templates/profile';
import { prepareProfile } from './profile';

describe('Prepare profile logic', () => {
  let logger: MockLogger;
  const userError = createUserError(false);
  const mockVersion = '1.0.0';
  const mockUsecaseNames = ['test-usecase'];
  const mockSuperJson = {};
  const superJsonPath = 'superface';

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(async () => {
    logger = new MockLogger();
  });

  it('creates profile with scope', async () => {
    const mockProfile = ProfileId.fromId('test-scope/test-name', {
      userError,
    });
    const writeIfAbsentSpy = jest
      .spyOn(OutputStream, 'writeIfAbsent')
      .mockResolvedValue(true);

    const writeOnceSpy = jest
      .spyOn(OutputStream, 'writeOnce')
      .mockResolvedValue();

    await expect(
      prepareProfile(
        {
          id: {
            profile: mockProfile,
            version: mockVersion,
          },
          usecaseNames: mockUsecaseNames,
          superJsonPath,
          superJson: mockSuperJson,
        },
        { logger }
      )
    ).resolves.toBeUndefined();

    expect(writeIfAbsentSpy).toHaveBeenCalledWith(
      'test-scope/test-name.supr',
      [
        `name = "${mockProfile.id}"\nversion = "1.0.0"\n// Profile specification: https://superface.ai/docs/comlink/profile\n`,
        complete(mockUsecaseNames[0]),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledWith(
      superJsonPath,
      expect.any(String)
    );
  });

  it('creates empty profile without scope', async () => {
    const mockProfile = ProfileId.fromId('test-name', { userError });
    const writeIfAbsentSpy = jest
      .spyOn(OutputStream, 'writeIfAbsent')
      .mockResolvedValue(true);
    const writeOnceSpy = jest
      .spyOn(OutputStream, 'writeOnce')
      .mockResolvedValue();

    await expect(
      prepareProfile(
        {
          id: {
            profile: mockProfile,
            version: mockVersion,
          },
          usecaseNames: mockUsecaseNames,
          superJsonPath,
          superJson: mockSuperJson,
        },
        { logger }
      )
    ).resolves.toBeUndefined();

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
    expect(writeIfAbsentSpy).toHaveBeenCalledWith(
      'test-name.supr',
      [
        `name = "${mockProfile.id}"\nversion = "1.0.0"\n// Profile specification: https://superface.ai/docs/comlink/profile\n`,
        complete(mockUsecaseNames[0]),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledWith(
      superJsonPath,
      expect.any(String)
    );
  });

  it('creates profile with scope when station flag is used', async () => {
    const mockProfile = ProfileId.fromId('test-scope/test-name', {
      userError,
    });
    const mockSuperJson = {};
    const writeIfAbsentSpy = jest
      .spyOn(OutputStream, 'writeIfAbsent')
      .mockResolvedValue(true);

    const writeOnceSpy = jest
      .spyOn(OutputStream, 'writeOnce')
      .mockResolvedValue();

    await expect(
      prepareProfile(
        {
          id: {
            profile: mockProfile,
            version: mockVersion,
          },
          usecaseNames: mockUsecaseNames,
          superJsonPath,
          superJson: mockSuperJson,
          options: {
            station: true,
          },
        },
        { logger }
      )
    ).resolves.toBeUndefined();

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
    expect(
      writeIfAbsentSpy
    ).toHaveBeenCalledWith(
      'grid/test-scope/test-name/profile.supr',
      [
        `name = "${mockProfile.id}"\nversion = "1.0.0"\n// Profile specification: https://superface.ai/docs/comlink/profile\n`,
        complete(mockUsecaseNames[0]),
      ].join(''),
      { dirs: true, force: undefined }
    );

    expect(writeOnceSpy).toHaveBeenCalledWith(
      superJsonPath,
      expect.any(String)
    );
  });

  it('creates profile with scope when force flag is used', async () => {
    const mockProfile = ProfileId.fromId('test-scope/test-name', {
      userError,
    });
    const writeIfAbsentSpy = jest
      .spyOn(OutputStream, 'writeIfAbsent')
      .mockResolvedValue(true);
    const writeOnceSpy = jest
      .spyOn(OutputStream, 'writeOnce')
      .mockResolvedValue();

    await expect(
      prepareProfile(
        {
          id: {
            profile: mockProfile,
            version: mockVersion,
          },
          usecaseNames: mockUsecaseNames,
          superJsonPath,
          superJson: mockSuperJson,
          options: {
            force: true,
          },
        },
        { logger }
      )
    ).resolves.toBeUndefined();

    expect(writeIfAbsentSpy).toHaveBeenCalledTimes(1);
    expect(writeIfAbsentSpy).toHaveBeenCalledWith(
      'test-scope/test-name.supr',
      [
        `name = "${mockProfile.id}"\nversion = "1.0.0"\n// Profile specification: https://superface.ai/docs/comlink/profile\n`,
        complete(mockUsecaseNames[0]),
      ].join(''),
      { dirs: true, force: true }
    );

    expect(writeOnceSpy).toHaveBeenCalledWith(
      superJsonPath,
      expect.any(String)
    );
  });
});
