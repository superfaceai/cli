export default `{{#each securityIds}}"{{this}}"{{#unless @last}}or {{/unless}}{{/each}}`;
