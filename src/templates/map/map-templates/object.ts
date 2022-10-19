export default `{{openObject}}` +
  `{{#each fields}}{{newLine (inc ../intent 2) }}` +
  `{{#ifeq model.modelType "Scalar"}}{{>Scalar use=../use}}{{/ifeq}}` +
  `{{#ifeq model.modelType "Enum"}}{{>Enum use=../use}}{{/ifeq}}` +
  `{{#ifeq model.modelType "Object"}}{{fieldName}}{{../use}} {{>Object model use=":" intent= (inc ../intent 2) }},{{/ifeq}}` +
  `{{#ifeq model.modelType "List"}}{{fieldName}}{{../use}} {{>Array model.model use=":" intent= (inc ../intent 2) }},{{/ifeq}}` +
  `{{/each}}{{newLine intent}}` +
  `{{closeObject}}`;
