// TODO: This can be divided into more pertials
export default `//   vvvvvv
http METHOD "/endpoint" {
//   ^^^^^^  change HTTP method and path

  {{#if defaultSecurityId}}
  security "{{defaultSecurityId}}"
  {{/if }}
  {{#unless defaultSecurityId }}
  security "specify security identifier"
  {{/unless }}

  request {
    {{#if input }}
    // pass input values
    query {}
    headers {}
    body {}
    {{/if }}
  }

  // map HTTP call response to a result or error
  response 200 "content-type" {
    return map result {
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

  response 500 "content-type" {
    return map error {
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
}
`;
