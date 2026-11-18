# Project memory

## Product intent & audience

- Admin Dashboard for managing/reporting — includes a Reports page with filtering, sorting, search, and pagination of records (likely transactions).
- Bulk email campaign system: cron-driven batch processing of campaign recipients with per-recipient status tracking (pending, sending, sent, failed).
- Backend uses edge functions (serverless) with direct DB queries; campaigns processed in batches via scheduled cron ticks.

## Brand personality & voice

- No brand-specific voice inferred yet.

## Visual design & UX direction

- Stack: Vite + React (JSX), Tailwind CSS, React hooks, Lucide React icons. Avoid extra UI/icon packages unless explicitly requested.
- Reports page UX: filter controls (status filters, date range, search), sortable columns, pagination with page/pageSize state.
- Default sort: most-recent-first (by transaction date).

## Decisions, constraints & rationale

- Backend is already optimized: DB-level pagination, batch queries — not a bottleneck.
- Reports load latency root cause: duplicate API calls from two overlapping `useEffect` hooks firing on every filter/sort/page change.
- Fix: consolidated fetch trigger into a single `useEffect([fetchRecords, page, pageSize])`. `fetchRecords` identity changes via `buildFetchBody` (which depends on all filter state), so filter changes still trigger fetch. Filter handlers explicitly call `setPage(1)`.
- Added database index on transaction date column to accelerate default sort + date-range filtering.
- Pattern: keep fetch logic in `useCallback` (`buildFetchBody`, `fetchRecords`) and let a single effect depend on their identities + pagination state. Avoid multiple effects that fetch the same resource.
- **Rate limit handling in bulk email:** `sendSingleEmail` detects rate limit errors by checking for "rate limit", "429", "too many requests", "throttle" in error messages; returns a `rateLimited` flag.
- **Batch pause & retry:** `processEmailCampaignBatch` stops sending immediately on rate limit, waits 60 seconds, then retries remaining recipients in the batch.
- **Pending reset for rate-limited recipients:** recipients still rate-limited after the 60s pause are reset to "pending" (not "failed") so the next cron cycle retries them automatically — no permanent loss from transient rate limiting.
- **Campaign completion guard:** rate-limited recipients reset to "pending" keep campaign in "sending" status, preventing premature "completed" marking.
- **Lock window extended** to accommodate the 60-second rate-limit pause and prevent concurrent batch processing.
- Applied to live "Amex is Live" campaign: 106 rate-limited recipients reset to "pending" (865 pending, 60 sent after reset).

## Open questions & assumptions

- Assumed `buildFetchBody` and `fetchRecords` are memoized with `useCallback` so identity changes track filter state changes.
- No explicit loading-state UX pattern confirmed (skeleton/spinner); may need attention if perceived load time remains an issue.
- No data caching / stale-while-revalidate strategy in place — could help if repeated identical queries occur.
- Rate-limit detection relies on substring matching in error messages — assumes the email provider's error messages consistently contain those keywords.
- 60-second pause is a fixed duration; may need tuning based on actual provider rate-limit reset window.
- No exponential backoff or jitter implemented for repeated rate-limit hits within the same campaign.