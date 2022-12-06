import type { Template } from '../../shared/template-renderer';
import _enum from './enum';
import field from './field';
import mapHeader from './header';
import http from './http';
import input from './input';
import list from './list';
import mapDocument from './map';
import object from './object';
import parameters from './parameters';
import path from './path';
import scalar from './scalar';
import security from './security';
import usecase from './usecase';
import value from './value';

const templateSet: Template[] = [
  { name: 'MapDocument', template: mapDocument },
  { name: 'MapHeader', template: mapHeader },
  { name: 'UseCase', template: usecase },
  { name: 'Input', template: input },
  { name: 'Field', template: field },
  { name: 'Http', template: http },
  { name: 'Scalar', template: scalar },
  { name: 'Array', template: list },
  { name: 'Object', template: object },
  { name: 'Enum', template: _enum },
  { name: 'Value', template: value },
  { name: 'Security', template: security },
  { name: 'Parameters', template: parameters },
  { name: 'Path', template: path },
];

export default templateSet;
