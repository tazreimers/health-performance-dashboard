# Health Performance Dashboard

Private dashboard for combining Garmin Forerunner 970 and WHOOP health and
training data. The application foundation is in place; provider connections
are not implemented yet.

## Local setup

Requirements: Node.js 20.9 or newer, npm, and Docker Desktop.
In PowerShell, if `npm` is blocked by the execution policy, use `npm.cmd`
instead (for example, `npm.cmd install`).

1. Copy `.env.example` to `.env`.
2. Set `TOKEN_ENCRYPTION_KEY` to a new 32-byte key encoded as Base64:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

3. Start the local PostgreSQL database and apply its schema:

   ```powershell
   docker compose up -d
   npm install
   npm run db:generate
   npm run db:migrate
   ```

4. Start the app with `npm run dev`, then open http://localhost:3000.

The credentials in `compose.yaml` are for local development only. Do not reuse
them in a deployed environment. Never commit `.env` or provider credentials.

## Current stage

The Next.js/TypeScript app, PostgreSQL migration workflow, and encrypted-token
storage primitive are the initial foundation. Real Garmin integration is
blocked on Garmin developer approval; WHOOP OAuth and both provider syncs are
still to come. Production deployment is deferred until the hosting target and
private authentication boundary are selected.

See [the integration plan](docs/garmin-whoop-dashboard-plan.md) for the
architecture, delivery phases, data model, and provider-access decisions.
