export enum AuthSecurityType {
  API_KEY = 'apiKey',
  HTTP = 'http',
}

export enum ApiKeySecurityIn {
  HEADER = 'header',
  BODY = 'body',
  PATH = 'path',
  QUERY = 'query',
}

export enum BasicAuthSecurityScheme {
  BASIC = 'basic',
}

export enum BearerTokenSecurityScheme {
  BEARER = 'bearer',
}
