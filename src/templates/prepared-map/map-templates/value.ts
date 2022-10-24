export default `{{#ifeq type "string"}}""{{/ifeq}}` +
  `{{#ifeq type "number"}}0{{/ifeq}}` +
  `{{#ifeq type "boolean"}}true{{/ifeq}}`;
