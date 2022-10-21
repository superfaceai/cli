export default `{{#ifeq type ""}}"value"{{/ifeq}}` +
  `{{#ifeq type "number"}}0{{/ifeq}}` +
  `{{#ifeq type "boolean"}}true{{/ifeq}}`;
