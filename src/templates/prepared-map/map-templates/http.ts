// TODO: This can be divided into more partials
export default `{{assign 'step' 1}}// {{@root.step}}) Change HTTP method and path to make an HTTP call
http POST {{>Path input=inputExampleScalarName}} {
  {{#if provider.securityIds}}
  {{assign 'step' (inc @root.step 1)}}// {{@root.step}}) Specify security scheme id from Provider JSON definition
  security {{>Security securityIds=provider.securityIds}}
  {{/if }}
  {{#unless provider.securityIds}}
  security none
  {{/unless}}

  {{assign 'step' (inc @root.step 1)}}// {{@root.step}}) Pass input values to the HTTP request
  request {
    {{#if input }}
    query {
      // param_name = input.fieldName
    }
    headers {}
    body {}
    {{/if }}
  }

  {{assign 'step' (inc @root.step 1)}}// {{@root.step}}) Map successful HTTP response to the result. The content type is optional
  response 200 "application/json" {
    return map result {{#if result }}{{#ifeq result.modelType "Scalar"}}{{>Scalar result.model }}{{/ifeq}}{{#ifeq result.modelType "Object"}}{{>Object result use=" =" indent=4 }}{{/ifeq}}{{#ifeq result.modelType "List"}}{{>Array result use=":" indent=4 }}{{/ifeq}}{{newLine 2}}{{/if }}
    {{#unless result }}
    //empty result
    {{/unless }}
  }

  {{assign 'step' (inc @root.step 1)}}// {{@root.step}}) Optionally map unsuccessful HTTP response to the use case error
  response 500 {
    return map error {{#if error }}{{#ifeq error.modelType "Scalar"}}{{>Scalar error.model }}{{/ifeq}}{{#ifeq error.modelType "Object"}}{{>Object error use=" =" indent=4 }}{{/ifeq}}{{#ifeq error.modelType "List"}}{{>Array error use=":" indent=4 }}{{/ifeq}}{{newLine 2}}{{/if }}
    {{#unless error }}
    //empty error
    {{/unless }}
  }
}
`;
