from typing import Optional, List, Any, Dict
import uuid
import os
import logging
from datetime import datetime, timezone
from fastapi import HTTPException, Depends, APIRouter, BackgroundTasks
from pydantic import BaseModel, Field, validator
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
import worker
from db import get_session
from models import Profile

logger = logging.getLogger("pdf-ingest.confirm_save")
router = APIRouter()

class ConfirmSavePayload(BaseModel):
    profile_id: Optional[str] = Field(None)
    external_id: Optional[str] = Field(None)
    email: Optional[str] = None
    name: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[List[str]] = None
    experience: Optional[List[Dict[str, Any]]] = None
    # Accept camelCase incoming key "rawText" while keeping the attribute name raw_text
    raw_text: Optional[str] = Field(None, alias="rawText")
    confidence: Optional[float] = Field(0.5)

    class Config:
        # allow population by either the field name (raw_text) or the alias (rawText)
        allow_population_by_field_name = True

    @validator("profile_id", pre=True, always=True)
    def validate_profile_id(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                return str(uuid.UUID(v))
            except ValueError:
                raise ValueError("profile_id must be a valid UUID")
        return v

def _is_blank(val: Optional[str]) -> bool:
    return val is None or (isinstance(val, str) and val.strip() == "")

async def _enqueue_llm_job(profile_id: str):
    try:
        enqueue_res = worker.enqueue_llm_cleanup(profile_id)
        if isinstance(enqueue_res, dict):
            job_obj = enqueue_res.get("job")
        else:
            job_obj = enqueue_res
        job_id = job_obj.get_id() if hasattr(job_obj, "get_id") else str(getattr(job_obj, "id", None))
        logger.info("Enqueued LLM job %s for profile %s", job_id, profile_id)
        return job_id
    except Exception as e:
        logger.error("Failed to enqueue LLM job for profile %s: %s", profile_id, str(e))
        return None

@router.post("/confirm-save")
async def confirm_save_handler(
    payload: ConfirmSavePayload,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
    if _is_blank(payload.email) and _is_blank(payload.external_id):
        draft_id = str(uuid.uuid4())
        logger.info("Draft profile (no persistence) id=%s", draft_id)
        return {"status": "draft", "id": draft_id}

    # Build payload defensively so we capture raw text whether the client sent
    # "raw_text" (snake_case) or "rawText" (camelCase).
    # Use by_alias=True to inspect the raw incoming keys as the client sent them.
    incoming_payload_dict = payload.dict(by_alias=True)
    raw_text_value = incoming_payload_dict.get("raw_text") or incoming_payload_dict.get("rawText")

    profile_data = payload.dict(exclude_unset=True, by_alias=False)
    # ensure an id/version exist
    profile_data.setdefault("id", str(uuid.uuid4()))
    profile_data.setdefault("version", 1)
    now = datetime.now(timezone.utc)
    profile_data["created_at"] = now
    profile_data["updated_at"] = now

    # If we found raw text under either key, persist it to the canonical snake_case key
    if raw_text_value:
        profile_data["raw_text"] = raw_text_value
        try:
            logger.info("Persisting raw_text for profile id=%s (length=%d)", profile_data.get("id"), len(raw_text_value))
        except Exception:
            logger.info("Persisting raw_text for profile id=%s", profile_data.get("id"))
    else:
        logger.debug("No raw_text found in incoming payload for profile id=%s", profile_data.get("id"))

    try:
        insert_stmt = insert(Profile).values(**profile_data)

        # Dynamically build the set_ clause for the ON CONFLICT UPDATE
        # Only update fields that are present in the incoming payload
        update_fields = {
            "name",
            "summary",
            "skills",
            "experience",
            "raw_text",
            "confidence",
            "version",
            "meta",
        }
        update_data = {
            key: getattr(insert_stmt.excluded, key)
            for key in update_fields
            if key in profile_data
        }
        update_data["updated_at"] = now

        on_conflict_stmt = insert_stmt.on_conflict_do_update(
            index_elements=[Profile.email],
            set_=update_data,
        ).returning(Profile.id, Profile.created_at, Profile.updated_at, Profile.confidence)

        result = await session.execute(on_conflict_stmt)
        saved_profile = result.first()
        await session.commit()

        if not saved_profile:
            raise HTTPException(status_code=500, detail="Failed to save profile")

    except SQLAlchemyError as e:
        await session.rollback()
        logger.exception("Database error during confirm-save: %s", e)
        raise HTTPException(status_code=500, detail="Database error")
    except Exception as e:
        await session.rollback()
        logger.exception("Unexpected error during confirm-save: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")

    response = {
        "id": str(saved_profile.id),
        "created_at": saved_profile.created_at.isoformat(),
        "updated_at": saved_profile.updated_at.isoformat(),
        "status": "saved",
    }

    llm_threshold = float(os.getenv("LLM_THRESHOLD", "0.6"))
    if saved_profile.confidence < llm_threshold:
        background_tasks.add_task(_enqueue_llm_job, str(saved_profile.id))

    return response
