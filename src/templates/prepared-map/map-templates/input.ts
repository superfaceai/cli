export default `{{#if input }}
// Available input fields:
{{#each input.fields }}
{{>Field location="input"}}
{{/each}}
{{/if }}
{{#unless input }}
// Empty input
{{/unless }}
`;
