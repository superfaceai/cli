export default `{{#if input }}
// input
{{#each input.fields}}
{{>Field }}
{{/each}}
{{/if }}
{{#unless input }}
//empty input
{{/unless }}
`;
