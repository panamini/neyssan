"""
LLM abstraction for pdf-ingest.

Provides a single function `refine_with_llm(raw_text: str, mock: bool = True, examples: list | None = None) -> dict`
which returns a JSON-serializable dict that should match the NormalizedProfile schema used by the FastAPI app.

Mock mode:
- Loads `sample_profile.json` shipped with the project and returns it (with some small adjustments).
- This allows tests and local development to run without API keys or network calls.

Real mode:
- Supports OpenAI (if PDF_INGEST_LLM_PROVIDER=openai) and Mistral (if PDF_INGEST_LLM_PROVIDER=mistral).
- Uses env vars to discover keys:
    - OPENAI_API_KEY
    - MISTRAL_API_KEY
    - PDF_INGEST_LLM_PROVIDER
- The implementation is intentionally defensive: timeouts, simple parsing, and clear exceptions.
"""
from __future__ import annotations
import os
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("pdf-ingest.llm")
logger.setLevel(logging.INFO)

# Default sample file shipped in the repo
_SAMPLE_PROFILE_PATH = os.path.join(os.path.dirname(__file__), "sample_profile.json")


def _load_sample_profile() -> Dict[str, Any]:
    try:
        with open(_SAMPLE_PROFILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.exception("Failed to load sample_profile.json: %s", e)
        # Fallback: small synthetic profile
        return {
            "name": None,
            "email": None,
            "summary": None,
            "skills": [],
            "experience": [],
            "education": [],
            "achievements": [],
            "rawText": None,
            "confidence": 0.9,
            "metadata": {"source": "llm_mock"}
        }


def refine_with_llm(raw_text: str, mock: bool = True, examples: Optional[List[Dict[str, Any]]] = None, timeout: int = 60) -> Dict[str, Any]:
    """
    Given resume raw_text, return a dict conforming to NormalizedProfile.

    Parameters:
    - raw_text: original extracted text to refine
    - mock: if True, return a canned response (loaded from sample_profile.json)
    - examples: optional few-shot examples (not used in mock)
    - timeout: request timeout for remote LLM calls (seconds)

    Returns:
    - dict matching NormalizedProfile fields (name, email, summary, skills, experience, education, achievements, rawText, confidence, metadata)

    NOTE: Caller MUST validate the returned dict against the Pydantic model before persisting it to DB.
    """
    if mock:
        logger.info("refine_with_llm: returning mock profile (mock=True)")
        profile = _load_sample_profile()
        profile["rawText"] = raw_text or profile.get("rawText")
        try:
            profile["confidence"] = float(profile.get("confidence", 0.9)) if profile.get("confidence") is not None else 0.9
        except Exception:
            profile["confidence"] = 0.9
        meta = profile.get("metadata") or {}
        meta.update({"llm": "mock", "llmRefinedAt": None})
        profile["metadata"] = meta
        return profile

    provider = os.getenv("PDF_INGEST_LLM_PROVIDER", "openai").lower()
    # Build a compact prompt; keep heavy prompt templates in docs/llm_refine_prompt.md
    system = "You are an expert resume parser. Return ONLY valid JSON matching the NormalizedProfile/Convex profile schema. Do NOT include fields outside this schema; respond with JSON only."

    # Construct the user prompt using str.format to avoid f-string triple-quote parsing issues.
    prompt_template = (
        "Raw resume text (first 3000 chars):\n\n"
        "{raw}\n\n"
        "Return a JSON object with these fields (omit null/missing fields):\n"
        "{{\n"
        '  "name": "Full Name",\n'
        '  "email": "email@example.com",\n'
        '  "summary": "Career summary",\n'
        '  "skills": ["skill1", "skill2"],\n'
        '  "experience": [\n'
        '    {{\n'
        '      "title": "Job Title",\n'
        '      "company": "Company Name",\n'
        '      "startDate": "YYYY-MM",\n'
        '      "endDate": "YYYY-MM",\n'
        '      "current": true,\n'
        '      "description": "Job details"\n'
        '    }}\n'
        '  ],\n'
        '  "education": [\n'
        '    {{\n'
        '      "degree": "Degree Name",\n'
        '      "school": "School Name",\n'
        '      "startDate": "YYYY-MM",\n'
        '      "endDate": "YYYY-MM",\n'
        '      "description": "Education details"\n'
        '    }}\n'
        '  ],\n'
        '  "achievements": ["Achievement 1", "Achievement 2"],\n'
        '  "confidence": 0.0\n'
        "}}\n\n"
        "If the input is sparse (contact-only), provide only the fields you can reliably infer and set a lower confidence (e.g., 0.3). Do not include wrapper keys, metadata, or extra fields. Ensure JSON is parseable.\n"
    )
    user_prompt = prompt_template.format(raw=raw_text[:3000])

    if provider == "openai":
        try:
            import openai
        except Exception as e:
            logger.exception("OpenAI package not installed: %s", e)
            raise RuntimeError("OpenAI SDK not available. Install `openai` or run in mock mode.") from e

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set; cannot call OpenAI. Run in mock mode or set the env var.")

        openai.api_key = api_key
        model = os.getenv("OPENAI_MODEL", "gpt-4o")
        try:
            resp = openai.ChatCompletion.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=1500,
                temperature=0.0,
                timeout=timeout, # Increased timeout
            )
            content = None
            if resp and "choices" in resp and len(resp["choices"]) > 0:
                choice = resp["choices"][0]
                if isinstance(choice, dict) and "message" in choice and "content" in choice["message"]:
                    content = choice["message"]["content"]
                elif "text" in choice:
                    content = choice["text"]

            if not content:
                raise RuntimeError("No content returned from LLM")

            import re
            m = re.search(r"(\{[\s\S]*\})", content.strip())
            json_text = m.group(1) if m else content.strip()
            parsed = json.loads(json_text)
            if "metadata" not in parsed or parsed["metadata"] is None:
                parsed["metadata"] = {}
            parsed["metadata"].update({"llm": "openai"})
            return parsed
        except Exception as e:
            logger.exception("LLM call (openai) failed: %s", e)
            raise

    if provider == "mistral":
        import httpx
        import time
        import re

        api_key = os.getenv("MISTRAL_API_KEY") or os.getenv("MISTRAL_KEY")
        if not api_key:
            raise RuntimeError("MISTRAL_API_KEY is not set; cannot call Mistral. Run in mock mode or set the env var.")

        # prefer official chat/completions endpoint per Mistral docs, fall back to model-specific endpoints
        mistral_chat_url = os.getenv("MISTRAL_CHAT_URL", "https://api.mistral.ai/v1/chat/completions")
        mistral_base = os.getenv("MISTRAL_API_URL", "https://api.mistral.ai/v1/models")
        model_name = os.getenv("MISTRAL_MODEL", "mistral-small-latest")

        candidate_paths = [
            mistral_chat_url,  # { "model": model, "messages": [...] }
            f"{mistral_base}/{model_name}/generate",
            f"{mistral_base}/{model_name}/completions",
            f"{mistral_base}/{model_name}/outputs",
            f"{mistral_base}/{model_name}/responses",
        ]

        LLM_RETRY_COUNT = int(os.getenv("LLM_RETRY_COUNT", "3"))
        LLM_RETRY_BACKOFF = float(os.getenv("LLM_RETRY_BACKOFF", "0.5"))
        LLM_TIMEOUT_CONNECT = float(os.getenv("LLM_TIMEOUT_CONNECT", "5.0"))
        LLM_TIMEOUT_READ = float(os.getenv("LLM_TIMEOUT_READ", "60.0"))

        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        # Two main payload shapes:
        # 1) Chat completions (recommended): { "model": "<model>", "messages": [ {role, content}, ... ] }
        # 2) Older model-specific shapes tried as fallbacks
        chat_payload = {"model": model_name, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_prompt}], "temperature": 0.0, "max_tokens": 1500}
        payload_variants = [
            chat_payload,
            {"input": user_prompt, "parameters": {"temperature": 0.0, "max_new_tokens": 1500}},
            {"prompt": user_prompt, "max_tokens": 1500, "temperature": 0.0},
            {"inputs": user_prompt, "parameters": {"temperature": 0.0, "max_new_tokens": 1500}},
        ]

        attempts = 0
        last_error = None
        for attempt in range(LLM_RETRY_COUNT):
            attempts = attempt + 1
            for url in candidate_paths:
                for payload in payload_variants:
                    try:
                        logger.info("Mistral try: url=%s attempt=%d payload_shape=%s", url, attempts, list(payload.keys()))
                        with httpx.Client(timeout=httpx.Timeout(LLM_TIMEOUT_CONNECT, read=LLM_TIMEOUT_READ), verify=True) as client:
                            r = client.post(url, headers=headers, json=payload)
                            text_snippet = (r.text or "")[:2000]
                            try:
                                r.raise_for_status()
                            except httpx.HTTPStatusError as he:
                                logger.warning("Mistral HTTP status error at %s: %s; snippet: %s", url, he, text_snippet)
                                last_error = he
                                continue

                            try:
                                resp_json = r.json()
                            except Exception:
                                resp_json = r.text

                            content = None
                            # Chat completions shape
                            if isinstance(resp_json, dict) and "choices" in resp_json and isinstance(resp_json["choices"], list) and len(resp_json["choices"]) > 0:
                                choice = resp_json["choices"][0]
                                if isinstance(choice, dict) and "message" in choice and isinstance(choice["message"], dict):
                                    content = choice["message"].get("content") or choice["message"].get("text")
                                elif isinstance(choice, dict) and "text" in choice:
                                    content = choice.get("text")
                            # Other shapes
                            if content is None and isinstance(resp_json, dict):
                                if "results" in resp_json and isinstance(resp_json["results"], list) and len(resp_json["results"]) > 0:
                                    first = resp_json["results"][0]
                                    if isinstance(first, dict):
                                        content = first.get("content") or first.get("text") or first.get("output")
                                if not content and "outputs" in resp_json and isinstance(resp_json["outputs"], list) and len(resp_json["outputs"]) > 0:
                                    first = resp_json["outputs"][0]
                                    if isinstance(first, dict):
                                        content = first.get("content") or first.get("text") or first.get("output")
                                content = content or resp_json.get("output") or resp_json.get("generated_text") or resp_json.get("text")
                            elif isinstance(resp_json, str):
                                content = resp_json

                            if not content:
                                last_error = RuntimeError(f"No content returned from Mistral at {url}; snippet: {text_snippet}")
                                logger.warning("%s", last_error)
                                continue

                            # Clean and parse JSON if necessary
                            content = re.sub(r'^```json\s*', '', content, flags=re.MULTILINE)
                            content = re.sub(r'\s*```$', '', content, flags=re.MULTILINE)
                            content = content.strip()

                            m = re.search(r'\{[\s\S]*\}', content)
                            json_text = m.group(0) if m else content
                            json_text = json_text[:20000]
                            parsed = json.loads(json_text)

                            if "metadata" not in parsed or parsed["metadata"] is None:
                                parsed["metadata"] = {}
                            parsed["metadata"].update({"llm": "mistral", "mistral_attempts": attempts, "mistral_url": url, "payload_shape": list(payload.keys())})

                            # Normalize common wrapper keys that some LLMs return.
                            # If the payload has an outer 'profile' or 'result' object, use it.
                            if isinstance(parsed, dict):
                                for candidate in ("profile", "result", "data", "output"):
                                    if candidate in parsed and isinstance(parsed[candidate], dict):
                                        logger.info("Normalized parsed payload from wrapper key: %s", candidate)
                                        inner = parsed[candidate]
                                        # preserve metadata from outer
                                        inner_meta = inner.get("metadata") or {}
                                        # merge metadata, outer has precedence
                                        inner_meta.update(parsed.get("metadata", {}))
                                        inner["metadata"] = inner_meta
                                        parsed = inner
                                        break

                            # Ensure required fields exist with safe defaults to avoid Pydantic validation errors later.
                            # Try multiple locations for confidence (top-level, metadata, llm_confidence)
                            conf_value = None
                            try:
                                if isinstance(parsed, dict) and "confidence" in parsed and parsed["confidence"] is not None:
                                    conf_value = float(parsed["confidence"])
                                elif isinstance(parsed, dict) and parsed.get("metadata") and parsed["metadata"].get("confidence") is not None:
                                    conf_value = float(parsed["metadata"].get("confidence"))
                                elif isinstance(parsed, dict) and parsed.get("metadata") and parsed["metadata"].get("llm_confidence") is not None:
                                    conf_value = float(parsed["metadata"].get("llm_confidence"))
                            except Exception:
                                conf_value = None

                            if conf_value is None:
                                conf_value = 0.5

                            if isinstance(parsed, dict):
                                parsed["confidence"] = conf_value
                                if "rawText" not in parsed or parsed["rawText"] is None:
                                    parsed["rawText"] = raw_text
                                parsed["metadata"].setdefault("llmRefinedAt", None)

                            # Log a short debug summary of the parsed structure to help debugging in container logs
                            try:
                                summary = {k: (type(v).__name__) for k, v in parsed.items() if k in ("name", "email", "confidence", "rawText")}
                                logger.info("Mistral parsed summary: %s", summary)
                            except Exception:
                                logger.info("Mistral parsed result (unable to summarize)")

                            return parsed

                    except (httpx.RequestError, httpx.HTTPStatusError) as e:
                        logger.warning("Mistral request error for url=%s attempt=%d: %s", url, attempt + 1, e)
                        last_error = e
                        continue
                    except json.JSONDecodeError as e:
                        logger.exception("Failed to parse Mistral JSON at url=%s: %s; snippet: %s", url, e, (json_text[:200] if 'json_text' in locals() else ""))
                        last_error = e
                        continue
                    except Exception as e:
                        logger.exception("Unexpected error calling Mistral at url=%s: %s", url, e)
                        last_error = e
                        continue

            if attempt < LLM_RETRY_COUNT - 1:
                time.sleep(LLM_RETRY_BACKOFF * (2 ** attempt))

        if last_error:
            raise RuntimeError(f"Mistral call failed after {LLM_RETRY_COUNT} attempts. Last error: {last_error}") from last_error
        else:
            raise RuntimeError(f"Mistral call failed after {LLM_RETRY_COUNT} attempts: unknown error")

    raise RuntimeError(f"Unsupported LLM provider: {provider}")
