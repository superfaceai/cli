//TODO: This can be divided into more pertials
export default `// mock HTTP call
http METHOD "/endpoint" {
  {{#if defaultSecurityId}}
  security "{{defaultSecurityId}}"
  {{/if }}
  {{#unless defaultSecurityId }}
  security "specify security"
  {{/unless }}
  request {
    {{#if input }}
    // pass input values
    body {}
    query {}
    headers {}
    {{/if }}
  }
  // handle success response
  response 200 "content-type" {
    // map result values
    map result {
      {{#if result }}
      {{#each result.fields}}
      {{>ResultField }}
      {{/each}}
      {{/if }}
      {{#unless result }}
      //empty result
      {{/unless }}
    }
  }

  // handle error response
  response 500 "content-type" {
    // map error values
    map error {
      {{#if error }}
      {{#each error.fields}}
      {{>ResultField }}
      {{/each}}
      {{/if }}
      {{#unless result }}
      //empty error
      {{/unless }}
    }
  }
}`;
