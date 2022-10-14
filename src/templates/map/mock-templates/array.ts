export default `[
{{#each items}}{{#ifeq kind "primitive"}}{{name}} {{use}} {{>Primitive }} {{/ifeq}}
{{#ifeq kind "object"}}{{name}} = {{>Object use=":"}} {{/ifeq}}
{{#ifeq kind "array"}}{{name}} = {{>Array use=":"}} {{/ifeq}}{{/each}})
]`;
