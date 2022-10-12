import { Template } from '../template-renderer';
import documentation from './documentation';
import field from './field';
import input from './input';
import mapDocument from './map';
import mapHeader from './header';
import usecase from './usecase';
import result from './result';
import http from './http';
import resultField from './result-field';
import error from './error';

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
