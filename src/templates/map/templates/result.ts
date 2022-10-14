export default `{{#if result }}
// map result values
{{#each result.fields}}
{{>Field}}

{{/each}}

{{/if }}
{{#unless result }}
//empty result
{{/unless }}`;
