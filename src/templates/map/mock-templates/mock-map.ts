export default `{{>MapHeader . }}

// Map specification: https://superface.ai/docs/comlink/reference/map

{{#each usecases}}
{{>UseCase }}
{{/each}}`;
