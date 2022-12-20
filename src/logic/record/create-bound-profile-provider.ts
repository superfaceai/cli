import type {
  MapDocumentNode,
  NormalizedSuperJsonDocument,
  ProfileDocumentNode,
  ProviderJson,
} from '@superfaceai/ast';
import type {
  AuthCache,
  FetchParameters,
  ICrypto,
  IFetch,
  ILogger,
  Interceptable,
  ITimers,
} from '@superfaceai/one-sdk';
import {
  BoundProfileProvider,
  Config,
  Events,
  NodeCrypto,
  NodeFetch,
  NodeFileSystem,
  NodeLogger,
  NodeTimers,
  profileAstId,
  resolveSecurityConfiguration,
  ServiceSelector,
} from '@superfaceai/one-sdk';
import { resolveIntegrationParameters } from '@superfaceai/one-sdk/dist/core/profile-provider/parameters';

export function createBoundProfileProvider({
  superJson,
  profileAst,
  mapAst,
  providerJson,
  options,
  configOptions,
}: {
  superJson: NormalizedSuperJsonDocument;
  profileAst: ProfileDocumentNode;
  mapAst: MapDocumentNode;
  providerJson: ProviderJson;
  options?: {
    crypto?: ICrypto;
    timers?: ITimers;
    logger?: ILogger;
    fetchInstance?: IFetch & Interceptable & AuthCache;
  };
  configOptions?: {
    cachePath?: string;
    disableReporting?: boolean;
    metricDebounceTimeMax?: number;
    metricDebounceTimeMin?: number;
    sandboxTimeout?: number;
    sdkAuthToken?: string;
    superfaceApiUrl?: string;
    superfaceCacheTimeout?: number;
    superfacePath?: string;
    debug?: boolean;
    cache?: boolean;
  };
}): {
  boundProfileProvider: BoundProfileProvider;
  requestsHandle: (FetchParameters & { url: string })[];
} {
  const crypto = options?.crypto ?? new NodeCrypto();
  const timers = options?.timers ?? new NodeTimers();
  const logger = options?.logger ?? new NodeLogger();
  const events = new Events(timers, logger);
  const fetchInstance = options?.fetchInstance ?? new NodeFetch(timers);

  let requests: (FetchParameters & { url: string })[] = [];

  events.on('pre-fetch', { priority: 1 }, async (_context, args) => {
    requests.push({
      ...args[1],
      url: args[0],
    });

    return { kind: 'continue' };
  });
  return {
    boundProfileProvider: new BoundProfileProvider(
      profileAst,
      mapAst,
      providerJson,
      new Config(NodeFileSystem, {
        disableReporting: true,
        ...configOptions,
      }),
      {
        services: new ServiceSelector(
          providerJson.services,
          providerJson.defaultService
        ),
        profileProviderSettings:
          superJson.profiles[profileAstId(profileAst)].providers[
            providerJson.name
          ],
        security: resolveSecurityConfiguration(
          providerJson.securitySchemes ?? [],
          superJson.providers[providerJson.name].security ?? [],
          providerJson.name
        ),
        parameters: resolveIntegrationParameters(
          providerJson,
          superJson?.providers[providerJson.name]?.parameters
        ),
      },
      crypto,
      fetchInstance,
      logger,
      events
    ),
    requestsHandle: requests,
  };
}
