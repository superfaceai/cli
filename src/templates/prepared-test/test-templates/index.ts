import type { Template } from '../../shared/template-renderer';
import array from '../../shared/templates/array';
import boolean from '../../shared/templates/boolean';
import number from '../../shared/templates/number';
import object from '../../shared/templates/object';
import string from '../../shared/templates/string';
import error from './error';
import success from './success';
import test from './test-template';
import usecase from './usecase';

const templateSet: Template[] = [
  { name: 'Test', template: test },
  { name: 'Success', template: success },
  { name: 'Error', template: error },
  { name: 'UseCase', template: usecase },
  { name: 'Object', template: object },
  { name: 'Array', template: array },
  { name: 'String', template: string },
  { name: 'Number', template: number },
  { name: 'Boolean', template: boolean },
];

export default templateSet;
