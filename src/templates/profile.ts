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
    // foo is required nullable string
    foo! string 

    // bar links to named field 
    bar 
  }
  result {
    // optional nullable string
    baz string
  }

  // error links to named model
  error error

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
      status = 400
      title = "Not Found"
    }
  }
}

// optional nullable boolean or number
field bar boolean | number 

model error {
  status enum {
    NOT_FOUND = 404,
    BAD_REQUEST = 400
  }

  // required string
  title! string!

  // optional string
  detail string! 
}
`;
}
