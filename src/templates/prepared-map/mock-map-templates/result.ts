export default `return map result {{#ifeq kind "object"}}{{>Object use="=" intent=0}}{{/ifeq}}{{#ifeq kind "array"}}{{>Array use=":" intent=0}}{{/ifeq}}
`;
