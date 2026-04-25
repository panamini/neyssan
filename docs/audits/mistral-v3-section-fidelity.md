# Mistral v3 Section Fidelity Audit

Date: 2026-04-13

## Active root causes
- `cv_parser_service/mistral_resume_v3/extraction_schema.py`
  - missing first-class top-level families for `achievements`, `hobbies/interests`, `affiliations`, and `additionalInformation`
  - experience narrative prose used `summary` instead of canonical `description`
  - no cross-family section order carrier
- `cv_parser_service/mistral_resume_v3/normalized_schema.py`
  - no canonical normalized fields for `hobbies`, `awards`, `publications`, `volunteering`, `affiliations`, or `additionalInformation`
  - experience narrative prose still used `summary`
- `cv_parser_service/mistral_resume_v3/post_validation.py`
  - flattened `awards` into top-level `achievements`
  - flattened `publications` and `volunteering` into generic `textSections`
  - preserved unsupported sections generically, but had no typed handling for hobbies/interests, affiliations, or additional information
  - could move narrative achievement text into bullets
  - stored `desiredPosition` without validating headline semantics
- `cv_parser_service/mistral_resume_v3/app_mapper.py`
  - emitted only a subset of first-class families in compatibility `normalized`
  - used fixed section ordering instead of source-aware ordering when such metadata existed

## Resulting policy
- Supported typed source sections stay typed in authoritative normalized output.
- Explicit but unsupported source sections stay preserved as generic titled sections with order.
- Trusted export remains authoritative-only and does not read raw compatibility surfaces.
