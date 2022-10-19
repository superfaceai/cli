export default `{{fieldName}}{{use}} {{>Value type=model.scalarType}}, // {{#if required}}required {{/if }}{{#unless required }}optional {{/unless }}{{model.scalarType}}`;
