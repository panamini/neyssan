from enum import Enum

class PipelineError(Enum):
    SHORT_TEXT = "short_text"
    PARSE_ERROR = "parse_error"
    CONVEX_TIMEOUT = "convex_timeout"
    VALIDATION_FAIL = "validation_fail"
    RACE_CONDITION = "race_condition"  # For wait/commit issues
    SCHEMA_MISMATCH = "schema_mismatch"  # For Pydantic fails
    UNKNOWN = "unknown"

ERROR_MESSAGES = {
    PipelineError.SHORT_TEXT.value: "The uploaded file lacks enough content for refinement. Try a full resume.",
    PipelineError.PARSE_ERROR.value: "We couldn’t parse this document. Please upload a standard resume format.",
    PipelineError.CONVEX_TIMEOUT.value: "Data sync timed out. Please retry.",
    PipelineError.SCHEMA_MISMATCH.value: "The parsed data didn’t match our profile structure.",
    PipelineError.RACE_CONDITION.value: "Profile data wasn’t ready yet. Try again in a moment.",
    PipelineError.UNKNOWN.value: "An unexpected error occurred. Please contact support.",
}
