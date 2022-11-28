export default `// specify test case name
it('should perform successfully', async () => {
  const result = await superface.run({
    useCase: '{{name}}',
    input: {{#ifeq input.kind "object"}}{{>Object input use=":" indent=4}}{{/ifeq}}{{#ifeq input.kind "array"}}{{>Array input use=":" indent=4}}{{/ifeq}}
  })
  
  expect(result.isOk()).toBe(true);
  expect(result).toMatchSnapshot();
});`;
