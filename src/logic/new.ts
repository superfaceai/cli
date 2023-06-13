import type { ProviderJson } from '@superfaceai/ast';

export async function newProfile(
  _provideJson: ProviderJson,
  _prompt?: string
): Promise<{ source: string; scope?: string; name: string }> {
  return {
    name: 'character-information',
    scope: 'starwars',
    source: `name = "starwars/character-information"
  version = "1.0.1"
  
  """
  Retrieve information about Star Wars characters from the Star Wars API.
  """
  usecase RetrieveCharacterInformation safe {
    input {
      characterName
    }
  
    result {
      height
      weight
      yearOfBirth
    }
  
    error {
      message
    }
  }
  
  "
  Character name 
  The character name to use when looking up character information
  "
  field characterName string
  
  "
  Height
  The height of the character
  "
  field height string
  
  "
  Weight
  The weight of the character
  "
  field weight string
  
  "
  Year of birth
  The year of birth of the character
  "
  field yearOfBirth string
  
  "
  Message
  The message for when an error occurs looking up character information
  "
  field message string
  `,
  };
}
