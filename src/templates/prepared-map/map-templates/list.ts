export default `[{{newLine (inc indent 2) }}` +
  `{{#unless model }}{{>Unknown this use=":"}}{{/unless}}` +
  `{{#if model }}{{#ifeq model.modelType "Scalar"}}{{>Scalar this scalarType=model.scalarType use=":" }},{{/ifeq}}` +
  `{{#ifeq model.modelType "Enum"}}{{>Enum this use=":" }},{{/ifeq}}` +
  `{{#ifeq model.modelType "Object"}}{{>Object model use=":" indent=(inc indent 2) }},{{/ifeq}}` +
  `{{#ifeq model.modelType "List"}}{{>Array this use=":" indent= (inc indent 2) }},{{/ifeq}}{{/if}}` +
  `{{newLine indent}}]`;
