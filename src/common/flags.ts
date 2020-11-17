import { flags } from '@oclif/command'
import { IOptionFlag } from '@oclif/command/lib/flags';
import { CLIError } from '@oclif/errors';

export type DocumentTypeFlag = 'auto' | 'map' | 'profile';
export const documentTypeFlag: IOptionFlag<DocumentTypeFlag> = flags.build({
  char: 't',
  description: 'Document type to parse. `auto` attempts to infer from file extension.',
  options: ['auto', 'map', 'profile'],
  parse(input, _context) {
    // Sanity check
    if (input !== 'auto' && input !== 'map' && input !== 'profile') {
      throw new CLIError('Internal error: unexpected enum variant', { exit: -1 })
    }

    return input;
  }
})({ default: 'auto' });