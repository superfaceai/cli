import {
  EXTENSIONS,
  MapDocumentNode,
  ProfileDocumentNode,
} from '@superfaceai/ast';
import { parseMap, parseProfile, Source } from '@superfaceai/parser';
import { dirname,join as joinPath } from 'path';

import { exists, mkdir, readFile } from '../common/io';
import { OutputStream } from '../common/output-stream';

export async function compileFixtureAsts(): Promise<void> {
  //This fixtures we use in our integration test and we need keep them in sync with our Parser/AST version
  const fixtures: Record<string, { source: string; ast: string }> = {
    //Strict
    strictProfile: {
      source: joinPath('fixtures', 'strict.supr'),
      ast: joinPath('fixtures', 'compiled', 'strict.supr.ast.json'),
    },
    strictMap: {
      source: joinPath('fixtures', 'strict.suma'),
      ast: joinPath('fixtures', 'compiled', 'strict.suma.ast.json'),
    },

    //Starwars
    starwarsProfile: {
      source: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'character-information.supr'
      ),
      ast: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'character-information.supr.ast.json'
      ),
    },
    starwarsProfileWithVersion: {
      source: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'character-information@1.0.2.supr'
      ),
      ast: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'character-information@1.0.2.supr.ast.json'
      ),
    },
    starwarsMap: {
      source: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'maps',
        'swapi.character-information.suma'
      ),
      ast: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'maps',
        'swapi.character-information.suma.ast.json'
      ),
    },
    starwarsMapWithVersion: {
      source: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'maps',
        'swapi.character-information@1.0.2.suma'
      ),
      ast: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'maps',
        'swapi.character-information@1.0.2.suma.ast.json'
      ),
    },
    starWarsMapWithUnverifiedProvider: {
      source: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'maps',
        'unverified-swapi.character-information.suma'
      ),
      ast: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'maps',
        'unverified-swapi.character-information.suma.ast.json'
      ),
    },
    spaceshipProfile: {
      source: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'spaceship-information.supr'
      ),
      ast: joinPath(
        'fixtures',
        'profiles',
        'starwars',
        'spaceship-information.supr.ast.json'
      ),
    },

    //Communication
    communicationProfile: {
      source: joinPath(
        'fixtures',
        'profiles',
        'communication',
        'send-email@1.0.1.supr'
      ),
      ast: joinPath(
        'fixtures',
        'profiles',
        'communication',
        'send-email@1.0.1.supr.ast.json'
      ),
    },
  };

  for (const fixture of Object.values(fixtures)) {
    if (!(await exists(fixture.source))) {
      throw new Error(`Path: ${fixture.source} does not exists`);
    }
    const source = await readFile(fixture.source, {
      encoding: 'utf-8',
    });

    let ast: MapDocumentNode | ProfileDocumentNode;
    if (fixture.source.endsWith(EXTENSIONS.profile.source)) {
      ast = parseProfile(new Source(source, fixture.source));
    } else if (fixture.source.endsWith(EXTENSIONS.map.source)) {
      ast = parseMap(new Source(source, fixture.source));
    } else {
      throw new Error(
        `Source path: ${fixture.source} has unexpected extension`
      );
    }
    if (
      !fixture.ast.endsWith(EXTENSIONS.profile.build) &&
      !fixture.ast.endsWith(EXTENSIONS.map.build)
    ) {
      throw new Error(`AST path: ${fixture.ast} has unexpected extension`);
    }

    if (!(await exists(fixture.ast))) {
      await mkdir(dirname(fixture.ast), { recursive: true });
    }

    await OutputStream.writeOnce(
      fixture.ast,
      JSON.stringify(ast, undefined, 2)
    );
  }
  console.log(`OK`);
}

if (require.main === module) {
  void compileFixtureAsts();
}
