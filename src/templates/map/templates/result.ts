export default `{{#if result }}
// map result values
{{#each result.fields}}
{{>Field location="body"}}

{{/each}}

{{/if }}
{{#unless result }}
//empty result
{{/unless }}`;
