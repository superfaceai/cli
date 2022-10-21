export default `{{#if integrationParameters }}
// use integration parameters
{{#each integrationParameters }}
// parameters.{{this}}
{{/each}}
{{/if }}
`;
