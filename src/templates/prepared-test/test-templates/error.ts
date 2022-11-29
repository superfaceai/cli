export default `// specify test case name
  it('should map error', async () => {
    const result = await superface.run({
      useCase: '{{name}}',
      input: {{#ifeq input.kind "object"}}{{>Object input use=":" indent=6}}{{/ifeq}}{{#ifeq input.kind "array"}}{{>Array input use=":" indent=6}}{{/ifeq}}
    })
    
    expect(result.isErr()).toBe(true);
    expect(result).toMatchSnapshot();
  });
`;
