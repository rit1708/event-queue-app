import { z } from 'zod';

export const generateTokenSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Token name is required').max(100).optional(),
    expiresInDays: z.number().int().positive().max(365).optional(), // Optional: 15 days default or no expiry
    neverExpires: z.boolean().optional().default(false),
  }),
});

export const tokenIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid token ID format'),
  }),
});

export const revokeTokenSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid token ID format'),
  }),
});

