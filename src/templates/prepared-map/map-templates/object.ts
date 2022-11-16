export default `{{openObject}}` +
  `{{#each fields}}{{newLine (inc ../indent 2) }}` +
  `{{#ifeq model.modelType "Scalar"}}{{>Scalar this scalarType=model.scalarType use=../use}}{{/ifeq}}` +
  `{{#ifeq model.modelType "Enum"}}{{>Enum use=../use}}{{/ifeq}}` +
  `{{#ifeq model.modelType "Object"}}{{fieldName}}{{../use}} {{>Object model use=":" indent= (inc ../indent 2) }},{{/ifeq}}` +
  `{{#ifeq model.modelType "List"}}{{fieldName}}{{../use}} {{>Array model.model use=":" indent= (inc ../indent 2) }},{{/ifeq}}` +
  `{{/each}}{{newLine indent}}` +
  `{{closeObject}}`;
