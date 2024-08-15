import Handlebars from "handlebars";

export function registerHelpers(hbs: typeof Handlebars) {
  Handlebars.registerHelper('escape', (item) => item.replace(/"/g, '\\"'));
  Handlebars.registerHelper('htmlescape', (item) => Handlebars.Utils.escapeExpression(item));
  Handlebars.registerHelper('eq', (a, b) => a === b);
}
