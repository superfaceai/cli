export default `[{{newLine (inc intent 2) }}` +
  `{{#ifeq modelType "Scalar"}}{{>Scalar use=":" }},{{/ifeq}}` +
  `{{#ifeq modelType "Enum"}}{{>Enum use=":" }},{{/ifeq}}` +
  `{{#ifeq modelType "Object"}}{{>Object this use=":" intent=(inc intent 2) }},{{/ifeq}}` +
  `{{#ifeq modelType "List"}}{{>Array this use=":" intent= (inc intent 2) }},{{/ifeq}}` +
  `{{newLine intent}}]`;
