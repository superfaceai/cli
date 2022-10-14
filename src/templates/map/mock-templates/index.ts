import type { Template } from '../template-renderer';
import array from './array';
import header from './header';
import mockMap from './mock-map';
import object from './object';
import number from './number';
import result from './result';
import usecase from './usecase';
import string from './string';
import boolean from './boolean';

const templateSet: Template[] = [
  { name: 'MockMapDocument', template: mockMap },
  { name: 'MapHeader', template: header },
  { name: 'UseCase', template: usecase },
  { name: 'Result', template: result },
  { name: 'Object', template: object },
  { name: 'Array', template: array },
  { name: 'Number', template: number },
  { name: 'String', template: string },
  { name: 'Boolean', template: boolean },
];

export default templateSet;
