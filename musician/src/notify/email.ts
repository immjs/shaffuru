import { z } from 'zod';
import { emailConfigSchema } from '../config.js';
import { BaseNotifier, Notification } from './base_notifier.js';
import Handlebars from 'handlebars';
import { registerHelpers } from '../helpers.js';

registerHelpers(Handlebars);

export class EmailNotifier extends BaseNotifier<'email'> {
  config: z.infer<typeof emailConfigSchema>;

  constructor(config: z.infer<typeof emailConfigSchema>) {
    super(config);
    throw new Error('Email notifier is not yet supported.');
    this.config = config;
  }

  async notify(events: Notification[]) {
    // TODO
  }
}
