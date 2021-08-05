import Mocha from 'mocha';

export const mocha = new Mocha({ timeout: 15000 });

export const suite = (suiteName: string): Mocha.Suite =>
  Mocha.Suite.create(mocha.suite, suiteName);

export const runMochaTests = (): void => {
  mocha.run();
};
