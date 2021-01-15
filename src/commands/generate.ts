import { Command, flags } from '@oclif/command';
import { ProfileDocumentNode } from '@superfaceai/ast';
import { join as joinPath } from 'path';

import { DocumentType, inferDocumentType } from '../common/document';
import { userError } from '../common/error';
import { ErrorCodes } from '../common/error-codes';
import { baseName, createDirectory, readFile, writeFile } from '../common/io';
import { generateInterfaces } from '../logic/generate';
import Compile from './compile';

export default class Generate extends Command {
  static description = `Generates interface to use Superface with from profile.`;

  static args = [
    {
      name: 'profile',
      required: true,
      description: 'Profile sources or ASTs to generate interfaces from',
    },
  ];

  static strict = false;

  static examples = [
    'superface generate SendSMS.supr',
    'superface generate -o src/SendSMS -u any SendSMS.supr',
    'superface generate SendSMS.supr SendEmail.supr.ast.json',
  ];

  static flags = {
    outputDirectory: flags.string({
      char: 'o',
      description: 'Output directory for the generated files',
      default: './src/generated',
    }),
    untypedType: flags.enum({
      char: 'u',
      description: 'Type to assign to untyped fields',
      options: ['any', 'unknown'],
      default: 'unknown',
    }),
  };

  async run(): Promise<void> {
    const { flags, argv } = this.parse(Generate);
    const { outputDirectory, untypedType, profiles } = this.validateInputs(
      flags,
      argv
    );

    const promises = profiles.map(async profile => {
      const profileName = baseName(profile);
      let profileAST: ProfileDocumentNode;
      const documentType = inferDocumentType(profile);

      if (documentType === DocumentType.PROFILE_AST) {
        profileAST = JSON.parse(
          (await readFile(profile)).toString()
        ) as ProfileDocumentNode;
      } else if (documentType === DocumentType.PROFILE) {
        profileAST = (await Compile.compileFile(
          profile,
          'profile'
        )) as ProfileDocumentNode;
      } else {
        throw userError(
          `Invalid profile: ${profileName}`,
          ErrorCodes.INVALID_PROFILE
        );
      }

      await createDirectory(outputDirectory.trim());

      const generated = generateInterfaces(
        profileAST,
        profileName,
        untypedType
      );

      await writeFile(
        joinPath(outputDirectory, profileName + '.ts'),
        generated,
        this.log.bind(this)
      );
      await writeFile(
        joinPath(outputDirectory, profileName + '.supr.ast.json'),
        JSON.stringify(profileAST),
        this.log.bind(this)
      );
    });

    await Promise.all(promises);
  }

  private validateInputs(
    flags: { outputDirectory: string; untypedType: string },
    argv: string[]
  ): {
    outputDirectory: string;
    untypedType: 'any' | 'unknown';
    profiles: string[];
  } {
    if (
      typeof flags.untypedType !== 'string' ||
      (flags.untypedType !== 'any' && flags.untypedType !== 'unknown')
    ) {
      throw userError(
        `Invalid value: ${flags.untypedType} for untyped type`,
        ErrorCodes.INVALID_VALUE_UNTYPED_TYPE
      );
    }

    const profiles = argv.map(arg => {
      if (typeof arg !== 'string') {
        throw userError(
          'Invalid profile name',
          ErrorCodes.INVALID_PROFILE_NAME
        );
      }

      return arg.trim();
    });

    return {
      outputDirectory: flags.outputDirectory.trim(),
      untypedType: flags.untypedType,
      profiles,
    };
  }
}
