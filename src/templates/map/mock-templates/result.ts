export default `return map result {{#ifeq kind "object"}} {{>Object use="="}} {{/ifeq}}{{#ifeq kind "array"}} {{>Array use=":"}} {{/ifeq}}
`;
