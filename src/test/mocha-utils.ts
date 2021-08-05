import Mocha, { Suite } from 'mocha';

export const suite = (parentSuite: Suite, suiteName: string): Suite =>
  Suite.create(parentSuite, suiteName);

export const runMochaTests = async (mocha: Mocha): Promise<void> => {
    return new Promise((resolve, reject) => {
      mocha.run(failures => {
        if (failures)
          reject('at least one test is failed, check detailed execution report');
        resolve();
      });
    });
};
