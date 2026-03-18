# Developer Quickstart

1. Copy `.env.local.example` to `.env.local` and fill in the values (or store your Mistral key in `~/.mistral_key`).
2. Launch the stack:
   ```bash
   ./run.sh up --ui
   ```
3. Probe the deployed parser:
   ```bash
   cd my-app
   npx --yes convex run --push actions/_probeMistral:probe
   ```
4. Inspect recent structured-upload logs without hanging:
   ```bash
   timeout 8s npx --yes convex logs --history 2000 \
     | grep -Eo '\\[Request ID: [a-f0-9]+\\]' \
     | tail -n1
   ```
   ```bash
   timeout 8s npx --yes convex logs --history 3000 \
     | sed -n "/\\[Request ID: $RID\\]/,+140p"
   ```
