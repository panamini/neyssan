import type { GenericDatabaseReader, GenericDatabaseWriter, GenericActionCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { TableNames } from "../types/schema";

// Re-export common types
export type QueryCtx = GenericDatabaseReader<DataModel>;
export type MutationCtx = GenericDatabaseWriter<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
export type { Doc, Id };

// Context types with generic table support
export type QueryContext<T extends TableNames = TableNames> = QueryCtx & {
  table: T;
};

export type MutationContext<T extends TableNames = TableNames> = MutationCtx & {
  table: T;
};

export type ActionContext<T extends TableNames = TableNames> = ActionCtx & {
  table: T;
};

// Utility types for function handlers
export type QueryFunction<Args = any, Return = any> = (
  ctx: QueryCtx,
  args: Args
) => Promise<Return>;

export type MutationFunction<Args = any, Return = any> = (
  ctx: MutationCtx,
  args: Args
) => Promise<Return>;

export type ActionFunction<Args = any, Return = any> = (
  ctx: ActionCtx,
  args: Args
) => Promise<Return>;
