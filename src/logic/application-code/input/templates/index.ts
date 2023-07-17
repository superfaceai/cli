import array from './array';
import boolean from './boolean';
import input from './input';
import number from './number';
import object from './object';
import string from './string';
import type { Template } from './template-renderer';

const templateSet: Template[] = [
  { name: 'Input', template: input },
  { name: 'Object', template: object },
  { name: 'Array', template: array },
  { name: 'String', template: string },
  { name: 'Number', template: number },
  { name: 'Boolean', template: boolean },
];

export default templateSet;
