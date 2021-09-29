import { ProfileId } from './profile';

export class MapId {
  public readonly profileId: ProfileId;
  public readonly provider: string;
  public readonly variant?: string;
  public readonly id: string;

  public static fromName(params: {
    profile: {
      name: string;
      scope?: string;
    };
    provider: string;
    variant?: string;
  }): MapId {
    return new MapId(
      ProfileId.fromScopeName(params.profile.scope, params.profile.name),
      params.provider,
      params.variant
    );
  }

  private constructor(
    profileId: ProfileId,
    provider: string,
    variant?: string
  ) {
    this.profileId = profileId;
    this.provider = provider;
    this.variant = variant;

    this.id = `${this.profileId.id}.${this.provider}`;
    if (this.variant) {
      this.id += `.${this.variant}`;
    }
  }

  withVersion(version?: string): string {
    return `${this.id}${version ? `@${version}` : ''}`;
  }

  toString(): string {
    return this.id;
  }
}
