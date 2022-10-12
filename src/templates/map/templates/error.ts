export default `{{#if error }}
// error
{{#each error.fields}}
{{>Field }}

{{/each}}

{{/if }}
{{#unless error }}
//empty error
{{/unless }}`;
