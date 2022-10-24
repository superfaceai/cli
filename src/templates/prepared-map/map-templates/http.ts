// TODO: This can be divided into more pertials
export default `//   vvvvvv
http METHOD "/endpoint" {
//   ^^^^^^  change HTTP method and path
  {{#if provider.securityIds}}
  security {{>Security securityIds=provider.securityIds}}
  {{/if }}

  request {
    {{#if input }}
    // pass input values
    query {}
    headers {}
    body {}
    {{/if }}
  }

  // map HTTP call response to a result or error
  response 200 "content-type" {
  //       ^^^ ^^^^^^^^^^^^^^ change status code and content type
    return map result {{#if result }}{{#ifeq result.modelType "Scalar"}}{{>Scalar result.model }}{{/ifeq}}{{#ifeq result.modelType "Object"}}{{>Object result use=" =" intent=4 }}{{/ifeq}}{{#ifeq result.modelType "List"}}{{>Array result.model use=":" intent=4 }}{{/ifeq}}{{newLine 2}}{{/if }}
    {{#unless result }}
    //empty result
    {{/unless }}
  }

  response 500 "content-type" {
    return map error {{#if error }}{{#ifeq error.modelType "Scalar"}}{{>Scalar error.model }}{{/ifeq}}{{#ifeq error.modelType "Object"}}{{>Object error use=" =" intent=4 }}{{/ifeq}}{{#ifeq error.modelType "List"}}{{>Array error.model use=":" intent=4 }}{{/ifeq}}{{newLine 2}}{{/if }}
    {{#unless error }}
    //empty error
    {{/unless }}
  }
}
`;
