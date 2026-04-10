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