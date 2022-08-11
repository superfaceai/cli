import { MapDocumentNode } from '@superfaceai/ast';

export const mockMapDocumentNode = (options?: {
  name?: string;
  scope?: string;
  version?: {
    major: number;
    minor: number;
    patch: number;
    label?: string;
  };
  providerName?: string;
}): MapDocumentNode => ({
  kind: 'MapDocument',
  astMetadata: {
    sourceChecksum: 'checksum',
    astVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
    parserVersion: {
      major: 1,
      minor: 0,
      patch: 0,
    },
  },
  header: {
    kind: 'MapHeader',
    profile: {
      scope: options?.scope,
      name: options?.name ?? 'test',
      version: {
        major: options?.version?.major ?? 1,
        minor: options?.version?.minor ?? 0,
        patch: options?.version?.patch ?? 0,
        label: options?.version?.label,
      },
    },
    provider: options?.providerName ?? 'test-provider',
  },
  definitions: [],
});
