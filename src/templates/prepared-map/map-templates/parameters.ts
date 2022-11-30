export default `{{#if integrationParameters }}
// Available integration parameters:
{{#each integrationParameters }}
// parameters.{{this}}
{{/each}}
{{/if }}
`;
