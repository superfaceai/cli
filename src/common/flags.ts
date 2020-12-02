import { flags } from '@oclif/command';
import { Definition, IOptionFlag } from '@oclif/command/lib/flags';

import { developerError } from './error';

export type DocumentTypeFlag = 'auto' | 'map' | 'profile';
export const documentTypeFlag: IOptionFlag<DocumentTypeFlag> = flags.build({
  char: 't',
  description:
    'Document type to parse. `auto` attempts to infer from file extension.',
  options: ['auto', 'map', 'profile'],
  parse(input, _context) {
    // Sanity check
    if (input !== 'auto' && input !== 'map' && input !== 'profile') {
      throw developerError('unexpected enum variant', 10001);
    }

    return input;
  },
})({ default: 'auto' });

export type SkipFileType = 'never' | 'exists' | 'always';
export const skipFileFlag: Definition<SkipFileType> = flags.build({
  options: ['never', 'exists', 'always'],
  parse(input, _context) {
    // Sanity check
    if (input !== 'never' && input !== 'exists' && input !== 'always') {
      throw developerError('unexpected enum variant', 10002);
    }

    return input;
  },
});
