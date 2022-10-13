import type { Template } from '../template-renderer';
import documentation from './documentation';
import error from './error';
import field from './field';
import mapHeader from './header';
import http from './http';
import input from './input';
import mapDocument from './map';
import result from './result';
import resultField from './result-field';
import usecase from './usecase';

const templateSet: Template[] = [
  { name: 'MapDocument', template: mapDocument },
  { name: 'MapHeader', template: mapHeader },
  { name: 'UseCase', template: usecase },
  { name: 'Documentation', template: documentation },
  { name: 'Input', template: input },
  { name: 'Field', template: field },
  { name: 'Result', template: result },
  { name: 'Http', template: http },
  { name: 'ResultField', template: resultField },
  { name: 'Error', template: error },
];

export default templateSet;
