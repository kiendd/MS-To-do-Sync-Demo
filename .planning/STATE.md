# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** Two-way sync that works correctly — changes in the app or MS To-do reflect in both places within 30 seconds
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 4 (Foundation)
Plan: 0 of 2 in current phase
Status: Ready to plan
Last activity: 2026-03-26 — REQUIREMENTS.md and ROADMAP.md created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Init: Use MSAL v5 (`@azure/msal-browser` + `@azure/msal-react`) — v3/v4 are out of active support
- Init: Azure App Registration must use "Single-page application" platform type (not "Web") — wrong type causes CORS errors at token endpoint
- Init: Request `offline_access` scope at login time — cannot be added to an existing session without re-login
- Init: Delta query polling (30s) over webhooks — webhooks require a public HTTPS backend endpoint

### Pending Todos

None yet.

### Blockers/Concerns

- shadcn/ui + Tailwind CSS version compatibility was in flux near Aug 2025 knowledge cutoff — verify current install instructions at https://ui.shadcn.com/docs/installation/vite before scaffolding (Phase 1)
- `orderDateTime` behavior for task sort order should be tested in Graph Explorer before committing to sort logic (Phase 2)
- Target Microsoft account type (personal vs. work/school) affects MSAL `authority` setting — confirm before Phase 1

## Session Continuity

Last session: 2026-03-26
Stopped at: Requirements and roadmap written; ready to begin Phase 1 planning
Resume file: None
