export default `return map result {{#ifeq kind "object"}}{{>Object use=" =" indent=0}}{{/ifeq}}{{#ifeq kind "array"}}{{>Array use=":" indent=0}}{{/ifeq}}
`;
