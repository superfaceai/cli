export default `describe('{{name}}', () => {
  {{#unless onlySuccess}}{{#if errorExample}}{{>Error errorExample name=name }}{{/if}}{{/unless}}
  {{#if successExample}}{{>Success successExample name=name }}{{/if}}
});`;
