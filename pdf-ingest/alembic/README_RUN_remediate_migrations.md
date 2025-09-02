

## **How to Run the Remediation Script**

This script ensures your Alembic/Postgres database is fully migrated, whether it’s a fresh DB or partially applied migrations.

### **1️⃣ Basic Usage**

```bash
bash remediate_migration_v1.sh --compose pdf-ingest/docker-compose.yml --compose pdf-ingest/docker-compose.override.yml --alembic-service alembic
```

**Explanation of flags:**

* `--compose <file>` : Docker Compose YAML file (repeatable if multiple files).
* `--alembic-service <name>` : The service name running Alembic (default: `alembic`).
* `--db-service <name>` : The database service name (default: `db`).
* `--db-user <user>` : Database user (default: `postgres`).
* `--db-name <name>` : Database name (default: `pdf_ingest`).
* `--versions-dir <path>` : Path to Alembic migration versions (default: `pdf-ingest/alembic/versions`).
* `--verbose` : Enable verbose logging for debugging.
* `-h, --help` : Show help and usage information.

---

### **2️⃣ Verbose Mode (Recommended for Debugging)**

```bash
bash remediate_migration_v1.sh --verbose --compose pdf-ingest/docker-compose.yml --compose pdf-ingest/docker-compose.override.yml
```

* Prints detailed steps and intermediate commands.
* Useful for identifying any schema or stamping issues.

---

### **3️⃣ Typical Workflow**

1. Ensure Docker Compose is installed and your services can run.
2. Confirm that your Alembic versions directory exists.
3. Run the remediation script (with or without verbose mode).
4. After completion, verify the database:

```bash
docker-compose exec db psql -U postgres -d pdf_ingest -c '\d'
docker-compose exec db psql -U postgres -d pdf_ingest -c 'SELECT * FROM alembic_version;'
```

---

### **4️⃣ Safety Notes**

* Always backup the database before running in production.
* Use a staging environment to test the script first.
* If warnings appear (yellow ⚠️), inspect schema and Alembic history before proceeding.

---

### **5️⃣ Example: Full Command**

```bash
bash remediate_migration_v1.sh \
  --compose pdf-ingest/docker-compose.yml \
  --compose pdf-ingest/docker-compose.override.yml \
  --alembic-service alembic \
  --db-service db \
  --db-user postgres \
  --db-name pdf_ingest \
  --verbose
```

✅ This ensures:

* Database is ready.
* `alembic_version` table is present and correctly stamped.
* All migrations are applied up to head.

bash ./remediate_migrations_v1.sh \
  --compose pdf-ingest/docker-compose.yml \
  --compose pdf-ingest/docker-compose.override.yml \
  --alembic-service alembic \
  --db-service db \
  --db-user postgres \
  --db-name pdf_ingest \
  --verbose
