export default `{{#if fieldName}}{{fieldName}}{{use}} {{/if}}{{>Value type='string'}}, // {{#if required}}required {{/if }}{{#unless required }}optional {{/unless }}any type`;
