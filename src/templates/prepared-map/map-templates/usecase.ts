export default `map {{name}} { 
  {{>Input .}}
  
  {{>Parameters integrationParameters=provider.integrationParameters}}
  // -----------------------

  {{>Http provider=provider inputExampleScalarName=inputExampleScalarName}}
}`;
