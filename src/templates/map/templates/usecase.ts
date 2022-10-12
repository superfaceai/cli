export default `{{> Documentation}}
map {{name}} { 
 {{>Input .}}

 {{>Http .}}

 {{>Result .}}
 {{>Error .}}
}`;
