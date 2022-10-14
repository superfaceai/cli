export default `{
  {{#each properties}}{{#ifeq kind "string"}}{{name}} {{../use}} {{>String }},
  {{/ifeq}}{{#ifeq kind "number"}}{{name}} {{../use}} {{>Number }},
  {{/ifeq}}{{#ifeq kind "boolean"}}{{name}} {{../use}} {{>Boolean }},
  {{/ifeq}}{{#ifeq kind "object"}}{{name}} = {{>Object use=":"}},
  {{/ifeq}}{{#ifeq kind "array"}}{{name}} = {{>Array use=":"}},{{/ifeq}}{{/each}}
}`;
