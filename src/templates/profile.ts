/**
 * Returns a usecase header with filled in `name` and `version`.
 */
export function header(name: string, version: string): string {
  return `name = "${name}"
version = "${version}"
// Comlink Profile specification: https://superface.ai/docs/comlink/profile
`;
}

export function empty(name: string): string {
  return `
"""
${name} usecase
"""
usecase ${name} {}
`;
}

export function complete(name: string): string {
  return `
"""
${name} usecase
"""
usecase ${name} {
  input {
    "field title"
    foo! string 

    bar 
  }

  result {
    baz string
  }

  error issue

  example success {
    input {
      foo = "example"
      bar = true
    }
    result {
      baz = "result"
    }
  }

  example fail {
    input {
      foo = "error"
      bar = false
    }
    error {
      title = "Not Found"
      detail = "Entity not found"
    }
  }
}

field bar boolean | number 

model issue {
  title! string!

  detail string! 
}`;
}
