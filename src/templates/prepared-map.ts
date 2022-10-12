import { ProviderJson } from '@superfaceai/ast';
import { Field, UseCaseDetail, UseCaseSlot } from '../stolen-from-air';
import { Model } from '../stolen-from-air/models/model-base';
import { header } from './map';

export function preparedMap({
  profileId,
  provider,
  version,
  variant,
  details,
}: {
  profileId: string;
  provider: ProviderJson;
  version: string;
  variant?: string;
  details: UseCaseDetail[];
}): string {
  return `${header(profileId, provider.name, version, variant)}\n${details
    .map(usecase)
    .join('')}`;
}

function usecase(detail: UseCaseDetail): string {
  return [
    intent(0, '"""\n'),
    intent(0, (detail.title ?? detail.name + 'map') + '\n'),
    intent(0, (detail.description ?? '') + '\n'),
    intent(0, '"""\n'),
    intent(0, `map ${detail.name} {` + '\n'),
    intent(2, '//input\n'),
    intent(2, (detail.input ? useCaseSlot(detail.input, 2) : '{}') + '\n'),
    intent(2, '//result\n'),
    intent(2, (detail.result ? useCaseSlot(detail.result, 2) : '{}') + '\n'),
    intent(0, '}'),
  ].join('');
}

export function http(detail: UseCaseDetail): string {
  const request = detail.input
    ? `
  request {
    body {
      // change property name and move to correct location
      ${(detail.input.fields ?? [])
        .map(f => `${f.fieldName} = input.${f.fieldName}`)
        .join('\n')}
    }
  }`
    : '';

  const response = detail.result
    ? `
  // add correct status code and content-type
  response 200 {
    map result {
      ${(detail.result.fields ?? [])
        .map(f => `${f.fieldName} = body.${f.fieldName}`)
        .join('\n')}
    }
  }`
    : '';
  return `http METHOD "endpoint" {
    ${request}
    ${response}
  }
  `;
}

function useCaseSlot(slot: UseCaseSlot, numberOfspaces: number): string {
  const i = numberOfspaces + 2;
  return intent(
    numberOfspaces,
    `${(slot.fields ?? []).map(f => field(f, i)).join('\n')}`
  );
}

function field(field: Field<Model>, numberOfspaces: number): string {
  const description = field.description ? `//${field.description}` : '';
  const parsedFied = `// ${field.fieldName} - ${
    field.required === true ? 'required' : 'optional'
  }, ${field.nonNull === true ? 'not null' : 'nullable'}`;

  return `${intent(numberOfspaces + 2, description)}\n${intent(
    numberOfspaces + 2,
    parsedFied
  )}`;
}

function intent(numberOfspaces: number, line: string): string {
  return 'w'.repeat(numberOfspaces) + line;
}
