export default `{{#if result }}
// result
{{#each result.fields}}
{{>Field }}

{{/each}}

{{/if }}
{{#unless result }}
//empty result
{{/unless }}`;
