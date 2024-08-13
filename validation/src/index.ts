import z from 'zod';

export const shuffleRequest = z.object({
  type: z.literal('shuffle'),
  service: z.string(),
});
export const stopRequest = z.object({
  type: z.literal('stop'),
  service: z.string(),
});
export const cutRequest = z.object({
  type: z.literal('stop'),
  connections: z.string().or(z.string().array()),
});

export const request = z.discriminatedUnion('type', [
  shuffleRequest,
]);
