import { TemplateType } from './common';

/**
 * Returns a usecase header with filled in `name` and `version`.
 */
export function header(name: string, version: string): string {
  return `name = "${name}"
version = "${version}"
`;
}

/**
 * Returns a usecase of given template `type` with given `name`.
 */
export function usecase(type: TemplateType, name: string): string {
  switch (type) {
    case 'empty':
      return empty(name);
    case 'pubs':
      return pubs(name);
  }
}

export function empty(name: string): string {
  return `
"""
${name} usecase
"""
usecase ${name} {}
`;
}

export function pubs(name: string): string {
  return `
"""
List pub opening hours
"""
usecase ${name} {
	input {
    "City where to look for pubs"
    city! string!
    "Optional regex to match the name against"
		nameRegex string!
	}

	result [{ name string, openingHours string }]

	error ${name}Error
}

model ${name}Error enum {
  "The API timed out because the request was too borad"
  TIMEOUT
}
`;
}
