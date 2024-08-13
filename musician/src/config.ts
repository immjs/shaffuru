import { promises as fsp } from 'fs';
import yaml from 'yaml';
import { z } from 'zod';
import { pemRegex } from './utils.js';
import cron from 'node-cron';

const port = z.number().min(1).max(65536);

export const serviceConfigSchema = z.object({
  name: z.string().min(3).max(64),
  port: z.number(),
  upnp: z.boolean().optional(),
  disabled: z.boolean()
    .default(false),
  number: z.number().min(0).max(65535)
    .default(1),
  range: z.tuple([port, port])
    .default([1, 65535]),
  cron_reload: z.string().refine((v) => cron.validate(v), { message: 'Provided string is not a valid cron expression' })
    .default('0 0 * * *'),
  forced: z.array(z.object({
    port: z.number().min(1).max(65536),
    disabled: z.boolean(),
  }))
    .default([]),
});

export const configSchema = z.object({
  config: z.object({
    upnp: z.boolean()
      .default(true),
    conductor: z.string().regex(/^wss?:\/\/.+(\:.+)$/)
      .optional(),
  }),
  trusted_keys: z.array(z.object({
    type: z.string(),
    data: z.string().regex(pemRegex),
  })),
  advertising_means: z.array(z.discriminatedUnion('type', [
    z.object({
      name: z.string().min(3).max(64),
      type: z.literal('email'),
      email: z.string().email(),
    }),
    z.object({
      name: z.string().min(3).max(64),
      type: z.literal('webhook'),
      url: z.string().url(),
      data: z.string(),
    }),
  ])),
  services: z.array(serviceConfigSchema),
});

export async function readConfig () {
  const configUnvalidated = yaml.parse(await fsp.readFile('/etc/shaffuru.yaml', 'utf8'));

  return configSchema.parse(configUnvalidated);
}
