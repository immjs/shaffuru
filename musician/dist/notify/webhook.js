import { BaseNotifier } from './base_notifier.js';
import Handlebars from 'handlebars';
import { registerHelpers } from '../helpers.js';
registerHelpers(Handlebars);
export class WebhookNotifier extends BaseNotifier {
    constructor(config) {
        super(config);
        this.config = config;
    }
    async notify(events) {
        await fetch(this.config.url, this.config.data
            ? ({
                body: Handlebars.compile(this.config.data, { noEscape: true })({ events }),
                headers: this.config.headers,
                method: 'POST',
            })
            : {})
            .then(async (v) => {
            if (!v.ok) {
                console.error(await v.text());
                throw new Error(); // TODO create distinct error
            }
        });
    }
}
