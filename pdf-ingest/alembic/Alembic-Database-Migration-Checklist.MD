Here’s a concise checklist to prevent issues like the one you just fixed:

---

### **Alembic & Database Migration Checklist**

1. **Revision IDs**

   * Use **short auto-generated IDs** from Alembic (`alembic revision --autogenerate`) instead of long custom strings.
   * Keep descriptive info in the migration **file name or docstring**, not the revision ID.

2. **Version Table**

   * Ensure `alembic_version.version_num` column can store your revision IDs:

     ```sql
     ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(255);
     ```
   * Only increase length if truly needed; prefer short IDs.

3. **Migration Ordering**

   * Always set `down_revision` correctly; check `alembic history --verbose`.
   * Avoid skipping revisions or manually inserting revision IDs unless stamping.

4. **Schema Safety**

   * Use `op.get_bind()` and `inspect()` for conditional checks (`if table exists`, `if column exists`) in migrations that may run multiple times.
   * For new tables/columns, always create **indexes explicitly** if needed.

5. **Environment & Docker**

   * Use `docker-compose run --rm alembic upgrade head` for migrations to ensure the correct environment.
   * Wait for PostgreSQL to be ready (`pg_isready`) before running migrations in scripts.

6. **Remediation Scripts**

   * Keep a script like your `remediate_migrations.sh` ready for **fresh or partially applied DBs**.
   * Include checks for:

     * `alembic_version` table existence
     * `llm_history` table
     * `profiles` table and `version` column

7. **Testing & Verification**

   * Always test migrations in a **staging DB** before production.
   * After running migrations, verify:

     ```bash
     docker-compose exec db psql -U postgres -d pdf_ingest -c '\d llm_history'
     docker-compose exec db psql -U postgres -d pdf_ingest -c '\d profiles'
     docker-compose exec db psql -U postgres -d pdf_ingest -c 'SELECT * FROM alembic_version;'
     ```

---

If you follow this checklist, you’ll **avoid long ID issues, missing tables, and partial migrations**.

I can also **rewrite your `remediate_migrations.sh`** as a fully future-proof template that handles both fresh and partial DB states—would you like me to do that next?
