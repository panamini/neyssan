Change direction now: do not use EXPERIENCE as the first family for schema-first improvement.

## Decision

Follow the hybrid approach:

- keep heuristics for stable families
- introduce structured extraction family by family via a POC
- compare the new structured family against the current heuristic pipeline
- do not pivot the whole parser yet

## Important

EXPERIENCE is not the first POC family.
It is too unstable and too likely to create cross-resume regressions.

## New task

Propose the best first schema-first POC family for this codebase, choosing only from:

- IDENTITY / CONTACT
- EDUCATION
- LANGUAGES

Base the recommendation on the actual live evidence we have already seen across:
- Jake
- Janice
- Anne
- Farman
- Robert Smith
- Robert Cooper

## Evaluation criteria

Compare the candidate family on:
1. implementation cost
2. stability on real fixtures
3. duplication risk
4. multilingual tolerance
5. blast radius / regression risk
6. ease of side-by-side comparison with the existing heuristic pipeline

## Output contract

Return only:
1. best first POC family
2. second-best fallback family
3. why EXPERIENCE should not be first here
4. exact files likely involved for the POC
5. smallest safe next implementation step
6. stop


## la roadmap la plus saine

Je ferais:

- **maintenant**: finir Experience
- **ensuite**: POC hybride sur IDENTITY / CONTACT
- **après**: slice heuristique ou hybride sur EDUCATION
- **ensuite**: SUMMARY
- **puis**: ACHIEVEMENTS
  
  //-------------------------//
  
  clean up 
  Plan mode only.

Paddle is no longer used in this project.

Do not mix this with the active parsing slice.
Do not touch Mistral behavior.
Do not touch runtime entrypoint wiring.
Do not do a broad cleanup.

Active task only:
identify the smallest safe cleanup to remove Paddle from the project.

Goal:
- remove unused Paddle runtime/build/test references
- keep the standard workflow unchanged:
  - `./run.sh up --ui`
  - Mistral OCR button
  - cloud/dev Convex + `https://parser.dasti.ai`
- keep parser behavior unchanged for active product flows

Inspect only what is necessary, especially:
- OCR engine selection paths
- Docker/build dependencies
- parser service/runtime references
- test/dev dependencies
- any env/config flags referring to Paddle

Return only:
1. ranked diagnosis
2. all remaining Paddle references that matter
3. earliest safe boundary
4. smallest safe patch
5. acceptance set
6. explicit non-goals
7. stop
   


verifier si les cv sont enregistrés dans convex data bases

-- add a warning that say u sure u wanna stop importing (or something best practice ux ui) when the user wanna change page whil importing a cv, or it should stop or being done and propagated while the user is doing somthing else, (pick the best behaviour in 2026 ux ui best practice and smart eless friction solutions)