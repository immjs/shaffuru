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
    notify: z.boolean().optional(),
    disabled: z.boolean()
        .default(false),
    number: z.number().min(0).max(65535)
        .default(1),
    range: z.tuple([port, port])
        .default([1, 65535]),
    cron_reload: z.string().refine((v) => cron.validate(v), { message: 'Provided string is not a valid cron expression' })
        .default('0 * * * *'),
    forced: z.array(z.object({
        port: z.number().min(1).max(65536),
        disabled: z.boolean(),
    }))
        .default([]),
});
export const webhookConfigSchema = z.object({
    name: z.string().min(3).max(64),
    type: z.literal('webhook'),
    url: z.string().url(),
    data: z.string().optional(),
    headers: z.record(z.string(), z.string()).default({}),
});
export const emailConfigSchema = z.object({
    name: z.string().min(3).max(64),
    type: z.literal('email'),
    email: z.string().email(),
});
export const notifyConfigSchema = z.discriminatedUnion('type', [
    emailConfigSchema,
    webhookConfigSchema,
]);
export const configSchema = z.object({
    config: z.object({
        upnp: z.boolean()
            .default(true),
        notify: z.boolean()
            .default(true),
        conductor: z.string().regex(/^wss?:\/\/.+(\:.+)$/)
            .optional(),
        iface: z.string()
            .optional(),
    })
        .default({}),
    trusted_keys: z.array(z.object({
        type: z.string(),
        data: z.string().regex(pemRegex),
    }))
        .default([]),
    notify: notifyConfigSchema.array()
        .default([]),
    services: z.array(serviceConfigSchema)
        .default([]),
});
export async function readConfig() {
    const configUnvalidated = yaml.parse(await fsp.readFile('/etc/shaffuru.yaml', 'utf8'));
    return configSchema.parse(configUnvalidated);
}
