export default `{{>MapHeader . }}

// Complete map specification: https://superface.ai/docs/comlink/reference/map

{{#each profile.useCases}}
{{>UseCase provider=../provider}}

{{/each}}
`;
