export async function repairJSON(
  broken: string,
  timeoutMs = 2000,
  llmCaller: (prompt: string) => Promise<string> = async () => {
    throw new Error("No llm caller provided to repairJSON");
  }
): Promise<string | null> {
  try {
    if (!broken || typeof broken !== "string") {
      console.log("[repairJSON] quick-reject: empty input");
      return null;
    }
    if (broken.trim().length < 20) {
      console.log("[repairJSON] quick-reject: too-short input");
      return null;
    }
    if (!/[{\[]/.test(broken) && !/(sections|profile|experience|skills|contact|metadata)/i.test(broken)) {
      console.log("[repairJSON] quick-reject: no JSON-like structure found");
      return null;
    }
  } catch {
    // continue to attempt repair
  }

  const fixPrompt = `You are a strict JSON repair assistant. The following text is intended to be valid JSON but may be malformed or include surrounding prose or provider wrapper objects. READ THESE INSTRUCTIONS CAREFULLY:
1) If the input appears to be a provider response object (contains keys like id, object, model, usage, output_text, full_response, metadata, instructions, status, etc.), EXTRACT and RETURN ONLY the nested JSON payload that represents the parsed CV. Do NOT return any provider wrapper keys.
2) Prefer, in this order, extracting the object found under:
   - response
   - fenced JSON inside output_text or text (for example, a fenced JSON block such as <FENCED_JSON> ... </FENCED_JSON> — extract the inner JSON)
   - fenced JSON inside full_response.choices[0].message.content
   - any nested object that contains at least one of these keys: sections, profile, experience, skills, contact, metadata
3) Return EXACTLY one single valid JSON object (no surrounding prose, no markdown fences, no wrapper keys). Do NOT include provider ids, timestamps, model names, or usage stats.
4) If you cannot confidently extract a clean JSON object, return the exact string NULL (without quotes).

EXAMPLES:
- Input: { "id": "...", "output_text": "<FENCED_JSON>{ \"sections\": [...] }</FENCED_JSON>", "model": "gpt-..." } -> Output: { "sections": [...] }
- Input: "Here is the JSON:\\n<FENCED_JSON>{ \"profile\": \"...\" }</FENCED_JSON>" -> Output: { "profile": "..." }

MALFORMED_JSON_PAYLOAD:
<START_PAYLOAD>
${broken}
</END_PAYLOAD>
`;
  console.log("[repairJSON] invoked. input length:", broken?.length ?? 0, "timeoutMs:", timeoutMs);

  try {
    const res = await Promise.race([
      llmCaller(fixPrompt),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error("repair timeout")), timeoutMs))
    ]).catch((e) => {
      console.warn("[repairJSON] llmCaller rejected:", e?.message ?? String(e));
      return null as any;
    });
    if (!res) {
      console.log("[repairJSON] no repair response");
      return null;
    }
    console.log("[repairJSON] llmCaller returned length:", res?.length ?? 0);

    const tryParse = (s: string | null) => {
      if (!s) return null;
      try {
        return JSON.parse(s);
      } catch (err) {
        console.log("[repairJSON] tryParse failed:", (err as Error).message);
        return null;
      }
    };

    // Direct parse
    let parsed = tryParse(res);
    if (parsed) {
      console.log("[repairJSON] direct parse succeeded");
      return JSON.stringify(parsed);
    }

    // Fenced JSON (common pattern)
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(res);
    if (fence && fence[1]) {
      console.log("[repairJSON] found fenced block, length:", fence[1].length);
      parsed = tryParse(fence[1].trim());
      if (parsed) {
        console.log("[repairJSON] fenced parse succeeded");
        return JSON.stringify(parsed);
      }
    }

    // Additional fenced marker variants
    const altFence = /<FENCED_JSON>\s*([\s\S]*?)\s*<\/FENCED_JSON>/i.exec(res) || /<JSON>\s*([\s\S]*?)\s*<\/JSON>/i.exec(res);
    if (altFence && altFence[1]) {
      try {
        parsed = tryParse(altFence[1].trim());
        if (parsed) {
          console.log("[repairJSON] alt fenced parse succeeded");
          return JSON.stringify(parsed);
        }
      } catch {}
    }

    // Loose fenced blocks
    const looseFence = /(?:BEGIN_JSON|START_JSON|<pre>)\s*([\s\S]*?\{[\s\S]*?\})\s*(?:END_JSON|<\/pre>)/i.exec(res);
    if (looseFence && looseFence[1]) {
      try {
        parsed = tryParse(looseFence[1].trim());
        if (parsed) {
          console.log("[repairJSON] loose fenced parse succeeded");
          return JSON.stringify(parsed);
        }
      } catch {}
    }

    // Candidate substring search for JSON objects with strong keys
    try {
      const jsonCandidateRegex = /(\{[\s\S]*?\})/g;
      let m: RegExpExecArray | null;
      while ((m = jsonCandidateRegex.exec(res)) !== null) {
        const candidate = m[1];
        if (/(\"sections\"|\"profile\"|\"experience\"|\"skills\"|\"contact\")/i.test(candidate)) {
          parsed = tryParse(candidate);
          if (parsed) {
            console.log("[repairJSON] found candidate JSON containing key and parsed successfully");
            return JSON.stringify(parsed);
          }
        }
      }
    } catch {}

    // Brace-scan
    const firstBrace = res.indexOf("{");
    if (firstBrace >= 0) {
      console.log("[repairJSON] scanning for first top-level object starting at index", firstBrace);
      let depth = 0;
      for (let i = firstBrace; i < res.length; i++) {
        const ch = res[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const candidate = res.slice(firstBrace, i + 1);
            parsed = tryParse(candidate);
            if (parsed) {
              console.log("[repairJSON] brace-scan parse succeeded");
              return JSON.stringify(parsed);
            }
            break;
          }
        }
      }
    }

    console.log("[repairJSON] unable to repair JSON - returning null");
    return null;
  } catch (err: any) {
    console.warn("[repairJSON] error during repair:", err?.message ?? String(err));
    return null;
  }
}