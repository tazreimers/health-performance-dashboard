# Garmin + WHOOP Dashboard Plan

## Goal

Build a private, single-user dashboard that brings data from a Garmin
Forerunner 970 (through Garmin Connect) and WHOOP into one daily training and
recovery view. The first release should answer:

- How recovered am I today?
- What training did I complete, and how demanding was it?
- How are sleep, HRV, resting heart rate, and training load trending?

The dashboard should preserve the source of every metric instead of pretending
that similarly named values have identical definitions.

## Provider access decision

Use official APIs only. Do not scrape Garmin Connect, use browser cookies, or
depend on reverse-engineered endpoints.

| Provider | Recommended integration | Data expected | Important constraint |
|---|---|---|---|
| Garmin | Start an application for the Garmin Connect **Personal API**; evaluate the Health API if its commercial/enterprise terms are a better fit. | Activities, wellness summaries, heart rate, HRV, sleep, Body Battery, training data where granted. | Access and available endpoints depend on Garmin approval and the selected program. |
| WHOOP | Register a WHOOP developer application and use OAuth 2.0 authorization-code flow with v2 endpoints. | Recovery, cycles/strain, sleep, workouts, profile, and body measurements. | Request only the scopes required for the dashboard; production user limits and review may apply. |

**Go/no-go checkpoint:** obtain sandbox credentials for both providers and
verify that a real Garmin Connect account and WHOOP account can authorize the
application. If Garmin access cannot be approved, keep its connector behind an
interface and defer it rather than substituting an unofficial integration.

Official references:

- [Garmin Connect Developer Program](https://developer.garmin.com/gc-developer-program/)
- [Garmin Health API](https://developer.garmin.com/gc-developer-program/enterprise/health-api/)
- [WHOOP API documentation](https://developer.whoop.com/api/)

## Proposed architecture

Start with a TypeScript web application:

```text
Garmin Connect API ----> Garmin connector ---\
                                                > normalization + storage ---> dashboard
WHOOP v2 API ---------> WHOOP connector ----/
                  ^              ^
                  |              |
             OAuth callbacks   scheduled sync/webhooks
```

Use these components:

| Component | Responsibility | Recommendation |
|---|---|---|
| Web application | Dashboard UI, account connection flow, manual refresh, and settings. | Next.js with TypeScript. |
| API/service layer | OAuth callbacks, token refresh, sync orchestration, webhook verification, and read APIs for the UI. | Next.js route handlers or a separate TypeScript service if deployment needs it. |
| Database | Encrypted provider tokens, raw provider payloads, normalized daily metrics, activities, and sync cursors. | PostgreSQL with Prisma or Drizzle. |
| Job runner | Backfills and incremental syncs without holding an HTTP request open. | Hosted scheduled jobs plus a queue once sync volume warrants it. |
| Secrets manager | OAuth client secrets and encryption key. | Deployment platform secret store; never commit `.env` files. |

Keep the application single-user at first, but include a local `user_id` in
every table. This avoids a later migration if household or coach access is
added.

## Data strategy

### Store three layers

1. **Connection data** stores encrypted refresh tokens, granted scopes,
   expiration, provider account ID, and consent timestamps.
2. **Raw imports** store the original JSON payload, provider resource ID,
   payload version, received time, and content hash. This makes connector bugs
   repairable without asking the user to reconnect or re-export data.
3. **Normalized records** support fast charts and cross-provider comparisons.
   They always retain `source_provider`, `source_record_id`, `observed_at`,
   `timezone`, and `imported_at`.

Use an idempotency key of `(provider, resource_type, provider_record_id,
provider_updated_at_or_payload_hash)` so retries and webhook redelivery cannot
duplicate records.

### Initial normalized model

| Entity | Core fields | Notes |
|---|---|---|
| `daily_metrics` | date, source provider, steps, active calories, resting HR, HRV, stress, body battery, strain, training load | Allow multiple rows per day and metric source; do not overwrite Garmin with WHOOP. |
| `sleep_sessions` | start/end instant, stage durations, efficiency, sleep performance, source provider | WHOOP and Garmin sleep algorithms differ; show each source separately by default. |
| `activities` | start/end instant, sport, distance, duration, calories, avg/max HR, elevation, training effect/strain | Link the same real-world workout only after a conservative matching rule is introduced. |
| `recoveries` | date, recovery score, HRV, resting HR, source provider | WHOOP Recovery is a provider score, not a universal recovery measurement. |
| `sync_runs` | provider, status, cursor, started/finished time, item counts, error summary | Provides an auditable sync history and retry target. |

Store timestamps in UTC, retain the provider's original timezone/offset, and
derive a user-local `health_date`. A sleep session crossing midnight must be
assigned consistently (initially, use the date on which the session ends).

### Metric presentation rules

- Label provider-specific scores explicitly: `WHOOP Recovery`, `Garmin Body
  Battery`, `Garmin Training Readiness`, and so on.
- Compare raw measures such as HRV and resting heart rate only with a
  source-specific baseline. Do not average values from providers.
- Treat Garmin activities as the primary workout detail source, and WHOOP
  workouts/cycles as complementary strain and physiological context.
- Display missing values as unavailable, never as zero.

## Delivery plan

### Phase 0 — validate access and product boundaries

**Outcome:** approved developer credentials, an agreed private-use deployment,
and a finalized metric inventory.

1. Create Garmin and WHOOP developer applications and configure separate local
   and production redirect URLs.
2. Confirm Garmin program terms, webhook/polling behavior, rate limits,
   backfill availability, and the precise resource feeds available to the
   Forerunner 970 account.
3. Connect each provider manually in a short proof of concept; save redacted
   example responses and document field mappings.
4. Define the first dashboard pages: Today, Training, Sleep, Trends, and
   Connections.

**Exit criteria:** both connections successfully import a recent day, and the
data dictionary identifies source, units, granularity, and refresh strategy
for every MVP metric.

### Phase 1 — foundation and secure connections

**Outcome:** a deployable app that can connect, disconnect, and safely store
provider credentials.

1. Scaffold the TypeScript application, database migration workflow, local
   environment template, and deployment pipeline.
2. Implement OAuth state, PKCE where supported, callback validation,
   encrypted refresh-token storage, token refresh, revocation/disconnect, and
   connection-status UI.
3. Add structured logs that include provider, sync run, and resource ID but
   never access tokens or raw health payloads.
4. Add account export/delete actions and a retention policy for raw payloads.

**Exit criteria:** reconnecting is safe, expired tokens recover correctly, and
disconnect removes provider tokens and queued work.

### Phase 2 — ingestion, backfill, and normalization

**Outcome:** reliable historical and incremental imports.

1. Build one connector per provider behind a shared interface:

   ```ts
   interface HealthProviderConnector {
     startAuthorization(userId: string): Promise<URL>;
     handleCallback(input: OAuthCallback): Promise<void>;
     backfill(userId: string, from: Date, to: Date): Promise<SyncResult>;
     syncIncremental(userId: string): Promise<SyncResult>;
     disconnect(userId: string): Promise<void>;
   }
   ```

2. Land WHOOP v2 first: profile, recovery, cycles, sleep, and workouts. Use
   pagination, cursor/checkpoint storage, and rate-limit-aware retries.
3. Add the Garmin feed(s) granted in Phase 0. Prefer provider push/webhooks;
   otherwise schedule a small incremental polling window with overlap.
4. Save raw events before normalization, then normalize inside a transaction.
5. Add replayable fixture tests for pagination, duplicate delivery, updated
   activities, time-zone boundaries, and missing fields.

**Exit criteria:** a 90-day backfill and repeated incremental sync produce no
duplicates, and failed runs can resume from their recorded cursor.

### Phase 3 — dashboard MVP

**Outcome:** useful daily decisions, not a generic chart gallery.

1. Build a **Today** page showing WHOOP Recovery, sleep summary, Garmin Body
   Battery/training readiness when available, resting HR, HRV trends, and
   current-day activity.
2. Build **Training** with Garmin activity detail and a day-level comparison
   to WHOOP strain/workouts.
3. Build **Sleep** with side-by-side source cards and a seven-day trend.
4. Build **Trends** for 7/28/90-day source-specific HRV, resting HR, sleep,
   strain/load, distance, and training time.
5. Add freshness badges: last successful import, source timestamp, and a
   manual sync button with clear error status.

**Exit criteria:** the owner can answer the three goal questions from the
dashboard and identify which source supplied every displayed value.

### Phase 4 — quality, operations, and expansion

**Outcome:** dependable long-term personal use.

1. Verify webhook signatures where offered; deduplicate deliveries and
   implement bounded exponential retries.
2. Add alerting for repeated sync failures, token refresh failures, and stale
   data.
3. Add database backups, restore drills, and provider API version monitoring.
4. Consider optional exports (CSV/JSON), annotations (illness, travel,
   races), goals, and an intentionally labeled derived readiness view.

## Security and privacy requirements

- Use HTTPS for all callbacks and webhook endpoints.
- Encrypt refresh tokens at rest with an application-managed key from the
  secret store; encrypt database backups too.
- Apply least-privilege OAuth scopes and request additional scopes only when a
  corresponding screen ships.
- Verify OAuth `state`; use PKCE when supported; never expose client secrets
  or tokens to browser code.
- Restrict the initial deployment with a private authentication boundary.
- Treat health data as sensitive: minimize retention, protect logs, and
  provide deletion/export before sharing the dashboard with others.

## Open decisions before implementation

1. Which Garmin developer program and terms are available for this personal
   dashboard?
2. Is the dashboard permanently single-user, or should it support a coach or
   household member in the first year?
3. Where should it be deployed, and does that platform provide a managed
   PostgreSQL database, scheduled jobs, and a secrets manager?
4. Is a 90-day history sufficient for the first backfill, or is multi-year
   trend analysis required?
5. Which Garmin-only metrics are essential: Body Battery, Training Readiness,
   Training Status, HRV Status, or detailed running dynamics?
