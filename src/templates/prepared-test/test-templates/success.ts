export default `// specify test case name
  it('should perform successfully', async () => {
    const result = await superface.run({
      useCase: '{{name}}',
      {{#if input}} 
      input: {{#ifeq input.kind "object"}}{{>Object input use=":" indent=6}}{{/ifeq}}{{#ifeq input.kind "array"}}{{>Array input use=":" indent=6}}{{/ifeq}}
      {{/if}}
      {{#unless input}} 
      input: {}
      {{/unless}}
    })
    
    expect(() => result.unwrap()).not.toThrow();
    expect(result).toMatchSnapshot();
  });`;