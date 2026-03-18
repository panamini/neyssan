/**
 * headless-parse.ts
 *
 * Run a headless parseCV against a sample CV and print parsed + mapped JSON.
 *
 * Usage:
 *   npx ts-node my-app/scripts/headless-parse.ts
 *
 * This file uses dynamic import so it works with the project's TS layout.
 */
import("ts-node/register").catch(() => null);

async function run() {
  try {
    // Import the parser (uses TypeScript sources).
    const mod = await import("../convex/lib/parsing/hybridParser");
    const parseCV = (mod as any).parseCV as (raw: string, opts?: any) => Promise<any>;

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

    console.log("Running headless parse (returnMappedCV: true)...");
    const res = await parseCV(raw, { returnMappedCV: true });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error("Headless parse failed:", e);
    process.exit(1);
  }
}

run();