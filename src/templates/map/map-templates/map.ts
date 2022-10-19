export default `{{>MapHeader . }}

// Map specification: https://superface.ai/docs/comlink/reference/map

{{#each details}}
{{>UseCase }}

{{/each}}
`;
