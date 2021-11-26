import { parseDocumentId } from '@superfaceai/parser';

import { UserError } from './error';

export class ProfileId {
  public readonly scope?: string;
  public readonly name: string;
  public readonly id: string;

  public static fromId(
    profileId: string,
    { userError }: { userError: UserError }
  ): ProfileId {
    const parsed = parseDocumentId(profileId);
    if (parsed.kind === 'error') {
      throw userError(`Invalid profile id: ${parsed.message}`, 1);
    }

    return ProfileId.fromScopeName(parsed.value.scope, parsed.value.middle[0]);
  }

  public static fromScopeName(
    scope: string | undefined,
    name: string
  ): ProfileId {
    return new ProfileId(scope, name);
  }

  private constructor(scope: string | undefined, name: string) {
    this.scope = scope;
    this.name = name;
    this.id = scope ? `${scope}/${name}` : name;
  }

  withVersion(version?: string): string {
    return `${this.id}${version ? `@${version}` : ''}`;
  }

  toString(): string {
    return this.id;
  }
}
