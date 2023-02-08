import type { Template } from '../../shared/template-renderer';
import array from '../../shared/templates/array';
import boolean from '../../shared/templates/boolean';
import number from '../../shared/templates/number';
import object from '../../shared/templates/object';
import string from '../../shared/templates/string';
import header from './header';
import mockMap from './mock-map';
import result from './result';
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
