import { BaseNotifier } from './base_notifier.js';
import Handlebars from 'handlebars';
import { registerHelpers } from '../helpers.js';
registerHelpers(Handlebars);
export class EmailNotifier extends BaseNotifier {
    constructor(config) {
        super(config);
        throw new Error('Email notifier is not yet supported.');
        this.config = config;
    }
    async notify(events) {
        // TODO
    }
}
