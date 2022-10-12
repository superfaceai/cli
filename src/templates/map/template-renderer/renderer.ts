import Handlebars from 'handlebars';

import { HELPERS } from './helpers';
import { Template } from './template.interface';

export function makeRenderer(
  templates: Template[] = [],
  entryPartial = 'index',
  helpers = HELPERS
): Handlebars.TemplateDelegate {
  const engine = Handlebars.create();

  helpers.forEach(({ name, helper }) => {
    engine.registerHelper(name, helper);
  });

  templates.forEach(({ name, template }) => {
    engine.registerPartial(name, template);
  });

  return engine.compile(`{{>${entryPartial}}}`, {
    noEscape: true,
    strict: true,
    explicitPartialContext: false,
    ignoreStandalone: false,
  });
}
