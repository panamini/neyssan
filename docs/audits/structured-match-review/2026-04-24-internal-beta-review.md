# Structured Match Internal Beta Readout

Reviewed cases: 30
Rollout gate: blocked

## Coverage
- admin_office: 4
- healthcare_regulated: 4
- long_duplicated_scrape: 2
- multilingual: 3
- negative_control: 2
- retail_service: 4
- security_licensed: 4
- short_noisy_scrape: 3
- technical: 4

## Label Counts
- acceptable but conservative: 8
- evidence missing: 1
- good: 15
- hard-gate issue: 1
- language issue: 1
- metadata leak: 1
- overmatched: 1
- undermatched: 1

## Rollout Gate Reasons
- high unknown counts produced overconfident scores
- blocker labels present: overmatched=1, metadata leak=1, hard-gate issue=1, language issue=1

## Recommended Next Actions
- tune tier gates
- hold rollout
- tune evidence matching

## Example Buckets
### falseStrong
- security_kith_robert_alpha (security_licensed, strong 94): overmatched

### falseWeak
- admin_office_alpha (admin_office, weak 29): undermatched

### overconfidentPartial
- short_noisy_alpha (short_noisy_scrape, partial 57): 

### extractionCorrectEvidenceFailed
- technical_alpha (technical, partial 58): evidence missing

### evidenceCorrectTierWrong
- security_kith_robert_alpha (security_licensed, strong 94): overmatched
- security_kith_robert_beta (security_licensed, partial 68): acceptable but conservative
- retail_service_gamma (retail_service, partial 60): acceptable but conservative
- admin_office_alpha (admin_office, weak 29): undermatched
- admin_office_gamma (admin_office, partial 57): acceptable but conservative

