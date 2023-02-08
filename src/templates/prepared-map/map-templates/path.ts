export default `{{#if input}}"/endpoint/api/{{openObject}} {{inputExampleScalarName}} {{closeObject}}"{{/if }}{{#unless input }}"/endpoint"{{/unless }}`;
