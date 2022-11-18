// TODO: This can be divided into more partials
export default `// 1) Change HTTP method and path to make an HTTP call
http POST "/endpoint" {

  // 2) Specify security identifier from Provider JSON definition
  {{#if provider.securityIds}}
  security {{>Security securityIds=provider.securityIds}}
  {{/if }}

  // 3) Pass input values to the HTTP request
  request {
    {{#if input }}
    // pass input values
    query {
      // param_name = input.fieldName
    }
    headers {}
    body {}
    {{/if }}
  }

  // 4) Map successful HTTP response to the result. The content type is optional
  response 200 "content-type" {
    return map result {{#if result }}{{#ifeq result.modelType "Scalar"}}{{>Scalar result.model }}{{/ifeq}}{{#ifeq result.modelType "Object"}}{{>Object result use=" =" indent=4 }}{{/ifeq}}{{#ifeq result.modelType "List"}}{{>Array result use=":" indent=4 }}{{/ifeq}}{{newLine 2}}{{/if }}
    {{#unless result }}
    //empty result
    {{/unless }}
  }

  // 5) Map unsuccessful HTTP response to the use case error
  response 500 {
    return map error {{#if error }}{{#ifeq error.modelType "Scalar"}}{{>Scalar error.model }}{{/ifeq}}{{#ifeq error.modelType "Object"}}{{>Object error use=" =" indent=4 }}{{/ifeq}}{{#ifeq error.modelType "List"}}{{>Array error use=":" indent=4 }}{{/ifeq}}{{newLine 2}}{{/if }}
    {{#unless error }}
    //empty error
    {{/unless }}
  }
}
`;
