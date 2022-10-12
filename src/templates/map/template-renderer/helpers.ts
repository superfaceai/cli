/* eslint-disable */
//TODO: add types
export const HELPERS = [
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
];

export default HELPERS;
