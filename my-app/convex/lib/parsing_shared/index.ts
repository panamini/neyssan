/**
 * parsing_shared index - re-exports public surface
 *
 * Keep this minimal during migration. Future work will move parse orchestration
 * here and make hybridParser a thin compatibility shim.
 *
 * Note: we avoid `export * from "./engine"` to prevent duplicate type re-exports
 * (engine and api both declare `ParseResult`). Export engine functions explicitly.
 */
 
 export * from "./api"
 export * from "./repair"
 export * from "./utils"
 export * from "./providers"
 
 // Explicit exports from engine to avoid duplicate-export of types like `ParseResult`
 export { parseCVEngine, parseCV } from "./engine"