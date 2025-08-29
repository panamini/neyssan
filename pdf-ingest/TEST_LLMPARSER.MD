Summary of next manual verifications you can run locally:

1. Health check: curl [](http://127.0.0.1:8000/api/v1/health)<http://127.0.0.1:8000/api/v1/health>

2. Create and save a profile via the review modal or: curl -X POST [](http://127.0.0.1:8000/api/v1/confirm-save)<http://127.0.0.1:8000/api/v1/confirm-save> -H "Content-Type: application/json" -d @- <<'JSON' { "name": "Test User", "email": "test-user@example.com", "summary": "test", "skills": ["Python"], "experience": [], "rawText": "test raw", "confidence": 0.1, "metadata": {} } JSON

   The response will include "llm_job_id" if the saved confidence < LLM_THRESHOLD (default 0.6).

3. Start an RQ worker to process queued LLM jobs: docker compose run --rm web rq worker default --url redis://redis:6379

4. Poll job status: curl [](http://127.0.0.1:8000/api/v1/rq-job/)<http://127.0.0.1:8000/api/v1/rq-job/>

5. Check the profile after job finishes: curl [](http://127.0.0.1:8000/api/v1/profiles/)<http://127.0.0.1:8000/api/v1/profiles/>
