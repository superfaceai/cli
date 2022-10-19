export default `{{#ifeq type "string"}}"value"{{/ifeq}}` +
  `{{#ifeq type "number"}}7{{/ifeq}}` +
  `{{#ifeq type "boolean"}}true{{/ifeq}}`;
