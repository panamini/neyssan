import uuid
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.ext.mutable import MutableDict

Base = declarative_base()


class Profile(Base):
    __tablename__ = "profiles"

    id = sa.Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = sa.Column(sa.Text, nullable=True)
    email = sa.Column(sa.Text, nullable=True, unique=True, index=True)
    summary = sa.Column(sa.Text, nullable=True)
    skills = sa.Column(JSONB, nullable=True)
    experience = sa.Column(JSONB, nullable=True)
    raw_text = sa.Column(sa.Text, nullable=True)
    confidence = sa.Column(sa.Float, nullable=True)
    meta = sa.Column(MutableDict.as_mutable(JSONB), nullable=True)
    # optimistic locking / version
    version = sa.Column(sa.Integer, nullable=False, server_default="1")
    created_at = sa.Column(sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
    updated_at = sa.Column(
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        onupdate=sa.func.now(),
        nullable=False,
    )

    # relationship to llm history (one-to-many)
    llm_history = relationship("LLMHistory", back_populates="profile", cascade="all, delete-orphan")


class LLMHistory(Base):
    __tablename__ = "llm_history"

    id = sa.Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = sa.Column(PG_UUID(as_uuid=True), sa.ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    run_time = sa.Column(sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False, index=True)
    provider = sa.Column(sa.Text, nullable=True)
    model = sa.Column(sa.Text, nullable=True)
    job_id = sa.Column(sa.Text, nullable=True, index=True)  # RQ job id or correlation id
    request_payload = sa.Column(JSONB, nullable=True)
    response_snippet = sa.Column(sa.Text, nullable=True)
    full_response = sa.Column(JSONB, nullable=True)
    confidence = sa.Column(sa.Float, nullable=True)
    merged = sa.Column(sa.Boolean, nullable=False, server_default=sa.text("false"))
    merge_notes = sa.Column(sa.Text, nullable=True)

    # Convex persist tracking (nullable; added for idempotent backend->Convex writes)
    convex_idempotency_key = sa.Column(sa.Text, nullable=True, index=True)
    convex_write_status = sa.Column(sa.Text, nullable=True, index=True)  # e.g. "pending","success","failed"
    convex_error = sa.Column(sa.Text, nullable=True)
    convex_written_at = sa.Column(sa.BigInteger, nullable=True)  # epoch ms
    convex_attempts = sa.Column(sa.Integer, nullable=True, server_default="0")
    convex_last_attempt_at = sa.Column(sa.BigInteger, nullable=True)  # epoch ms

    profile = relationship("Profile", back_populates="llm_history")
