from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_session
from models import Profile, LLMHistory
from utils.full_raw_text import build_full_raw_text

router = APIRouter()


@router.get("/api/v1/profiles/{profile_id}/full-raw-text")
async def get_profile_full_raw_text(
    profile_id: str,
    include_llm_history: bool = Query(False),
    llm_items: int = Query(3),
    session: AsyncSession = Depends(get_session),
) -> Dict[str, Any]:
    """
    Read-only endpoint that returns a single canonical fullRawText and sources metadata.
    Query params:
      - include_llm_history: whether to include recent LLMHistory parsed outputs
      - llm_items: how many LLMHistory rows to include (when include_llm_history=true)
    """
    try:
        # Validate & load profile
        profile = await session.get(Profile, profile_id)
        if profile is None:
            raise HTTPException(status_code=404, detail="Profile not found")

        llm_rows = None
        if include_llm_history:
            try:
                stmt = (
                    select(LLMHistory)
                    .where(LLMHistory.profile_id == profile.id)
                    .order_by(LLMHistory.run_time.desc())
                    .limit(max(0, int(llm_items)))
                )
                rows = await session.execute(stmt)
                rows = rows.scalars().all()
                llm_rows = [{"full_response": r.full_response, "run_time": getattr(r, "run_time", None)} for r in rows]
            except Exception:
                # Best-effort: if fetching history fails, continue without it
                llm_rows = None

        result = build_full_raw_text(
            profile, include_llm_history=bool(include_llm_history), llm_histories=llm_rows, max_llm_items=llm_items
        )
        return {"profile_id": str(profile.id), "fullRawText": result["text"], "sources": result["sources"]}
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid profile id")
    except Exception as e:
        import logging
        logging.getLogger("pdf-ingest.full_raw_text").exception("Error assembling fullRawText for %s: %s", profile_id, e)
        raise HTTPException(status_code=500, detail="Internal error assembling full raw text")
