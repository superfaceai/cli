export default `describe('{{name}}', () => {
  {{#if errorExample}}{{>Error errorExample name=name }}{{/if}}
  {{#if successExample}}{{>Success successExample name=name }}{{/if}}
});`;
