export default `{{#if input }}
// use inputs
{{#each input.fields }}
{{>Field location="input"}}
{{/each}}
{{/if }}
{{#unless input }}
//empty input
{{/unless }}
`;
