export default `{{>MapHeader . }}

// Map specification: https://superface.ai/docs/comlink/reference/map

{{#each profile.useCases}}
{{>UseCase provider=../provider}}

{{/each}}
`;
