export default '[{{#each items}}{{newLine (inc ../indent 2) }}{{#ifeq kind "string"}}{{>String }},{{/ifeq}}{{#ifeq kind "number"}}{{>Number }},{{/ifeq}}{{#ifeq kind "boolean"}}{{>Boolean }},{{/ifeq}}{{#ifeq kind "object"}}{{>Object use=":" indent=(inc ../indent 2) }},{{/ifeq}}{{#ifeq kind "array"}}{{>Array use=":" indent= (inc ../indent 2) }},{{/ifeq}}{{/each}}{{newLine indent}}]';