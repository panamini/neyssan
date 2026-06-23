/* eslint-disable @typescript-eslint/no-explicit-any -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { z } from 'zod';
import { mutation, query, action } from '../_generated/server';


// Generic wrapper for Zod validation
export function withZod<Args extends z.ZodRawShape, Ret>({ 
  args, 
  handler 
}: {
  args: Args;
  handler: (ctx: any, args: z.infer<z.ZodObject<Args>>) => Promise<Ret>;
}) {
  const schema = z.object(args).strict();
  
  return async (ctx: any, rawArgs: any) => {
    const result = schema.safeParse(rawArgs);
    if (!result.success) {
      throw new Error(`Validation failed: ${result.error.message}`);
    }
    return handler(ctx, result.data);
  };
}

// Convenience wrappers for different function types
export const queryWithZod = <Args extends z.ZodRawShape, Ret>({ 
  args, 
  handler 
}: {
  args: Args;
  handler: (ctx: any, args: z.infer<z.ZodObject<Args>>) => Promise<Ret>;
}) => query(withZod({ args, handler }));

export const mutationWithZod = <Args extends z.ZodRawShape, Ret>({ 
  args, 
  handler 
}: {
  args: Args;
  handler: (ctx: any, args: z.infer<z.ZodObject<Args>>) => Promise<Ret>;
}) => mutation(withZod({ args, handler }));

export const actionWithZod = <Args extends z.ZodRawShape, Ret>({ 
  args, 
  handler 
}: {
  args: Args;
  handler: (ctx: any, args: z.infer<z.ZodObject<Args>>) => Promise<Ret>;
}) => action(withZod({ args, handler }));

// Base schema fields
export const baseFields = {
  createdAt: z.number().positive(),
  updatedAt: z.number().positive(),
  version: z.number().nonnegative(),
  userId: z.string().min(1),
  status: z.string().min(1)
};

// Helper to extend a schema with base fields
export function extendWithBaseFields<T extends z.ZodRawShape>(schema: T) {
  return z.object({
    ...schema,
    ...baseFields
  }).strict();
}

// Helper to create a schema with enum status
export function createSchemaWithStatus<T extends z.ZodRawShape>(
  schema: T,
  statuses: [string, ...string[]]
) {
  return z.object({
    ...schema,
    ...baseFields,
    status: z.enum(statuses)
  }).strict();
}
