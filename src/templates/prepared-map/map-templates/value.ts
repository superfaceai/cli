export default `{{#ifeq type "string"}}{{#if value}}{{escapedString value}}{{/if}}{{#unless value}}""{{/unless}}{{/ifeq}}` +
  `{{#ifeq type "number"}}{{#if value}}{{value}}{{/if}}{{#unless value}}0{{/unless}}{{/ifeq}}` +
  `{{#ifeq type "boolean"}}{{#if value}}{{value}}{{/if}}{{#unless value}}true{{/unless}}{{/ifeq}}`;
