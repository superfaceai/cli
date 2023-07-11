export default '{{openObject}}{{#each properties}}{{#ifeq kind "string"}}{{newLine (inc ../indent 2) }}{{quotes ../language}}{{name}}{{quotes ../language}} {{../use}} {{>String }},{{/ifeq}}{{#ifeq kind "number"}}{{newLine (inc ../indent 2) }}{{quotes ../language}}{{name}}{{quotes ../language}}{{../use}} {{>Number }},{{/ifeq}}{{#ifeq kind "boolean"}}{{newLine (inc ../indent 2) }}{{quotes ../language}}{{name}}{{quotes ../language}}{{../use}} {{>Boolean language=../language }},{{/ifeq}}{{#ifeq kind "object"}}{{newLine (inc ../indent 2) }}{{quotes ../language}}{{name}}{{quotes ../language}}{{../use}} {{>Object use=":" indent= (inc ../indent 2) language=../language }},{{/ifeq}}{{#ifeq kind "array"}}{{newLine (inc ../indent 2) }}{{quotes ../language}}{{name}}{{quotes ../language}}{{../use}} {{>Array use=":" indent= (inc ../indent 2) language=../language}},{{/ifeq}}{{/each}}{{newLine indent}}{{closeObject}}';
