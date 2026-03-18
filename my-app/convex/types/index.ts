import type { Doc, Id } from "../_generated/dataModel";
import type { SystemTableNames } from "convex/server";
import type { TableNames } from "./schema";

// Re-export types from schema
export type { MetricDoc, AlertDoc, Documents } from "./schema";

// Combine system and schema table names
export type AllTableNames = TableNames | SystemTableNames;

// Define base document type
export type BaseDoc<T extends AllTableNames = AllTableNames> = {
  _id: Id<T>;
  _creationTime: number;
};

// Define utility types
export type WithoutSystemFields<T> = Omit<T, keyof BaseDoc>;
export type OptionalId<T extends BaseDoc<any>> = Omit<T, "_id"> & { _id?: T["_id"] };
export type WithoutId<T extends BaseDoc<any>> = Omit<T, "_id">;

// Re-export Convex types
export type { Doc, Id };
