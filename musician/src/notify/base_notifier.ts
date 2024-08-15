import { z } from 'zod';
import { notifyConfigSchema } from '../config.js';

export interface Notification {
  title: string;
  message: string;
}

export class BaseNotifier<T extends z.infer<typeof notifyConfigSchema>['type']> {
  constructor(config: z.infer<typeof notifyConfigSchema> & { type: T }) {}

  async notify(notifications: Notification[]) {}
}
