import type { ProviderJson } from '@superfaceai/ast';

export async function mapProviderToProfile(
  _providerJson: ProviderJson,
  _profileSource: string
): Promise<string> {
  return `function RetrieveCharacterHomeworld({ input, parameters, services }) {
    const searchCharacterResult = searchCharacter(input, services);
    const getHomeworldResult = getHomeworld(searchCharacterResult);
  
    return getHomeworldResult;
  }
  
  function searchCharacter(input, services) {
    const url = \`\${services.default}/people\`;
    const options = {
      method: 'GET',
      query: {
        search: input.search,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  
    const response = std.unstable.fetch(url, options).response();
    const body = response.bodyAuto() ?? {};
  
    if (response.status !== 200) {
      const error = {
        detail: \`Error fetching data: \${response.status}\`,
        rate_limit: 10000,
        remaining_requests: parseInt(
          response.headers['x-ratelimit-remaining'][0] ?? '0',
          10
        ),
        reset_time: response.headers['x-ratelimit-reset'][0] ?? '',
      };
      throw new std.unstable.MapError(error);
    }
  
    const result = {
      homeworld: body.results[0]?.homeworld ?? '',
    };
  
    return result;
  }
  
  function getHomeworld(searchCharacterResult) {
    const homeworld_url = searchCharacterResult.homeworld;
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
  
    const response = std.unstable.fetch(homeworld_url, options).response();
    const body = response.bodyAuto() ?? {};
  
    if (response.status !== 200) {
      const error = {
        detail: \`Failed to fetch homeworld information. Status: \${response.status}\`,
        rate_limit: 10000,
        remaining_requests: parseInt(
          response.headers['x-ratelimit-remaining'][0] ?? '0',
          10
        ),
        reset_time: response.headers['x-ratelimit-reset'][0] ?? '',
      };
      throw new std.unstable.MapError(error);
    }
  
    const result = {
      name: body.name,
      diameter: body.diameter,
      rotation_period: body.rotation_period,
      orbital_period: body.orbital_period,
      gravity: body.gravity,
      population: body.population,
      climate: body.climate,
      terrain: body.terrain,
      surface_water: body.surface_water,
      residents: body.residents,
      films: body.films,
      url: body.url,
      created: body.created,
      edited: body.edited,
    };
  
    return result;
  }
  `;
}
