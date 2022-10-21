export default `{{> Documentation}}
map {{name}} { 
  {{>Input .}}
  
  {{>Parameters integrationParameters=provider.integrationParameters}}

  {{>Http provider=provider}}
}`;
