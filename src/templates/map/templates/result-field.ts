export default `{{fieldName}} = body.{{fieldName}} // {{#if required}}required {{/if }}{{#unless required }}optional {{/unless }}{{#if type }}{{type}}{{/if }}{{#unless type }}string{{/unless }}
`;
