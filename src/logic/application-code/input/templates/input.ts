export default '{{#if input}}{{#ifeq input.kind "object"}}{{>Object input use=":" indent=6}}{{/ifeq}}{{#ifeq input.kind "array"}}{{>Array input use=":" indent=6}}{{/ifeq}}{{/if}}';
