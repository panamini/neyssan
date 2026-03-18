/**
 * headless-parse.mjs
 *
 * ESM entry that dynamically imports the TypeScript parser using the ts-node ESM loader.
 * Run with:
 *   node --loader ts-node/esm ./scripts/headless-parse.mjs
 *
 * This file uses only ESM APIs (no require) to avoid CJS/ESM interop issues.
 */
const raw = `PAULINE RIOUX
Administrativa Comercial con Francés📍 París, Francia | 📧 pauline.rioux@gmail.com | 📞 +33 6 23 45 67 89
🔗 https://www.linkedin.com/in/pauline.rioux
🔗 linkedin.com/in/pauline.rioux

Administrativa Comercial con Francés
Administrativa Comercial con Español

Summary:
Administrativa comercial con 3+ años de experiencia en exportación, especializada en mercados francés y español. Dominio avanzado del español (DELE C1) y sólidos conocimientos de SAP. Proactiva, con habilidades comerciales y organizativas, orientada a resultados. En transición a España (enero 2021) para asumir un rol en la gestión de clientes franceses en Naturgy (Valencia).

Skills:
SAP (avanzado), Negociación y ventas, Gestión de cartera de clientes (francés y español), Análisis de mercado, Multilingüe: Francés (C2), Español (C1), Inglés (B2)

Experience:
- Lactalis, París — Administrativa Comercial (Mayo 2017 – Actualidad)
  - Gestión de 120 clientes franceses y 30 españoles, con seguimiento de pedidos y tramitación en SAP.
  - Elaboración de hasta 10 ofertas diarias (presupuestos y captación de clientes).
  - Aumento del 15% anual en ventas y cierre de 45 ventas mensuales.
  - Análisis de mercado y desarrollo de estrategias para expansión en Francia y España.

Education:
Máster en Comercio Internacional y Exportación — Université Paris 8 (2015 – 2017)
Grado en Comercio Internacional — Université Paris Descartes (2012 – 2015)
`;

try {
  // Resolve the parser module relative to this script
  const modUrl = new URL('../convex/lib/parsing/hybridParser.ts', import.meta.url).href;
  const mod = await import(modUrl);
  const parseCV = mod.parseCV || (mod.default && mod.default.parseCV);
  if (!parseCV) {
    console.error('parseCV not found in hybridParser module');
    process.exit(2);
  }

  console.log('Running headless parse (returnMappedCV: true)...');
  const res = await parseCV(raw, { returnMappedCV: true });
  // Print compact summary first, then full JSON
  console.log('--- Parsed sections count:', (res.sections || []).length, 'method:', res.method);
  console.log(JSON.stringify(res, null, 2));
} catch (err) {
  console.error('Headless parse error:', err);
  process.exit(1);
}