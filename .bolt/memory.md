# Project memory

## Product intent & audience

- Admin Dashboard for managing/reporting — includes a Reports page with filtering, sorting, search, and pagination of records (likely transactions).
- Backend uses edge functions (serverless) with direct DB queries.

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

## Open questions & assumptions

- Assumed `buildFetchBody` and `fetchRecords` are memoized with `useCallback` so identity changes track filter state changes.
- No explicit loading-state UX pattern confirmed (skeleton/spinner); may need attention if perceived load time remains an issue.
- No data caching / stale-while-revalidate strategy in place — could help if repeated identical queries occur.