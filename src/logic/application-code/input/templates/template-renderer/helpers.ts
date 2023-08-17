/* eslint-disable */

import { SupportedLanguages } from '../../../application-code';

//TODO: add types
export const HELPERS = [
  {
    name: 'assign',
    helper: function (name: any, value: any, options: any) {
      if (!options.data.root) {
        options.data.root = {};
      }
      options.data.root[name] = value;
    },
  },
  {
    name: 'ifeq',
    helper: function (a: any, b: any, options: any) {
      // @ts-ignore
      if (a === b) return options.fn(this);
      // @ts-ignore
      return options.inverse(this);
    },
  },
  {
    name: 'switch',
    helper: function (value: any, options: any) {
      // @ts-ignore
      this.switch_value = value;
      // @ts-ignore
      this.switch_break = false;
      // @ts-ignore
      return options.fn(this);
    },
  },
  {
    name: 'case',
    helper: function (value: any, options: any) {
      // @ts-ignore
      if (value == this.switch_value) {
        // @ts-ignore
        this.switch_break = true;
        // @ts-ignore
        return options.fn(this);
      }
    },
  },
  {
    name: 'default',
    helper: function (options: any) {
      // @ts-ignore
      if (this.switch_break == false) {
        // @ts-ignore
        return options.fn(this);
      }
    },
  },
  {
    name: 'typeof',
    helper: function (value: any) {
      return typeof value;
    },
  },
  {
    name: 'escapedString',
    helper: function (value: any) {
      if (value === '') return '""';
      if (!value) return value;
      if (value.includes("'")) {
        if (value.includes('"')) {
          return `"${value.replace(/\"/g, '\\"')}"`;
        }

        return `"${value}"`;
      }

      return `'${value}'`;
    },
  },
  {
    name: 'newLine',
    helper: function (value: number) {
      return `\n${' '.repeat(value)}`;
    },
  },
  {
    name: 'inc',
    helper: function (value: any = 0, amount = 2) {
      return parseInt(value) + amount;
    },
  },
  {
    name: 'quotes',
    helper: function (language: string) {
      if (language === SupportedLanguages.PYTHON) {
        return `"`;
      }
      return '';
    },
  },
  {
    name: 'comment',
    helper: function (language: string) {
      if (language === SupportedLanguages.PYTHON) {
        return `#`;
      }
      return '//';
    },
  },

  {
    name: 'booleanValue',
    helper: function (language: string, value: boolean) {
      if (language === SupportedLanguages.PYTHON) {
        return value ? 'True' : 'False';
      }
      return value;
    },
  },

  {
    name: 'openObject',
    helper: function () {
      return `{`;
    },
  },
  {
    name: 'closeObject',
    helper: function () {
      return `}`;
    },
  },
];

export default HELPERS;
