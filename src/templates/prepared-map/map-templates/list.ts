export default `[{{newLine (inc indent 2) }}` +
  `{{#ifeq modelType "Scalar"}}{{>Scalar use=":" }},{{/ifeq}}` +
  `{{#ifeq modelType "Enum"}}{{>Enum use=":" }},{{/ifeq}}` +
  `{{#ifeq modelType "Object"}}{{>Object this use=":" indent=(inc indent 2) }},{{/ifeq}}` +
  `{{#ifeq modelType "List"}}{{>Array this use=":" indent= (inc indent 2) }},{{/ifeq}}` +
  `{{newLine indent}}]`;
