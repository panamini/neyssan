# Dev: start server
npx convex dev

# Dev migration (dry-run)
npx convex run migrations:run '{"fn":"migrations:renameRawText","dryRun":true}'

# Dev migration (apply)
npx convex run migrations:run '{"fn":"migrations:renameRawText"}'

# Prod deploy
CONVEX_DEPLOY_KEY="prod:XXXXXXXX" npx convex deploy --cmd 'npm run build'

# Prod migration
npx convex run migrations:run '{"fn":"migrations:renameRawText"}' --prod

# Preview deploy
CONVEX_DEPLOY_KEY="preview:XXXXXXXX" npx convex deploy --cmd 'npm run build' --preview-name "my-branch-preview"

# Preview migration
npx convex run migrations:run '{"fn":"migrations:renameRawText"}' --preview-name "my-branch-preview"
