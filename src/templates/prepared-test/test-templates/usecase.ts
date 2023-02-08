export default `describe('{{name}}', () => {
  {{#unless onlySuccess}}{{#if errorExamples}}{{#each errorExamples}}{{>Error this name=../name }}{{/each}}{{/if}}{{/unless}}
  {{#if successExamples}}{{#each successExamples}}{{>Success this name=../name }}{{/each}}{{/if}}
});`;
