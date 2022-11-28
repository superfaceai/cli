import type { Template } from '../template-renderer';
import array from './array';
import boolean from './boolean';
import header from './header';
import mockMap from './mock-map';
import number from './number';
import object from './object';
import result from './result';
import string from './string';
import usecase from './usecase';

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
