export default `{{openObject}}` +
  `{{#each fields}}{{newLine (inc ../indent 2) }}` +
  `{{#unless model }}{{>Unknown this use=../use}}{{/unless}}` +
  `{{#if model }}{{#ifeq model.modelType "Scalar"}}{{>Scalar this scalarType=model.scalarType use=../use}}{{/ifeq}}` +
  `{{#ifeq model.modelType "Enum"}}{{#if fieldName}}{{fieldName}}{{/if}}{{#unless fieldName}}unknonwn{{/unless}}{{../use}} {{>Enum }}{{/ifeq}}` +
  `{{#ifeq model.modelType "Object"}}{{#if fieldName}}{{fieldName}}{{/if}}{{#unless fieldName}}unknonwn{{/unless}}{{../use}} {{>Object model use=":" indent= (inc ../indent 2) }},{{/ifeq}}` +
  `{{#ifeq model.modelType "List"}}{{#if fieldName}}{{fieldName}}{{/if}}{{#unless fieldName}}unknonwn{{/unless}}{{../use}} {{>Array model use=":" indent= (inc ../indent 2) }},{{/ifeq}}` +
  `{{#ifeq model.modelType "Union"}}{{#if fieldName}}{{fieldName}}{{/if}}{{#unless fieldName}}unknonwn{{/unless}}{{../use}} {{>Union model use=":"}},{{/ifeq}}{{/if}}` +
  `{{/each}}{{newLine indent}}` +
  `{{closeObject}}`;
