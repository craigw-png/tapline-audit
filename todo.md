# Tapline Creator Partnership Audit Tool — TODO

## Phase 1: Database & Foundation
- [x] Database schema: brands, audits, competitors, ad_data tables
- [x] Run migration SQL
- [x] Drizzle schema types and query helpers in db.ts

## Phase 2: Backend / API Layer
- [x] Mock data engine: Ninja Kitchen UK May 2026 (52 ads, 8% partnership)
- [x] Meta Ads Library API connector (with mock fallback)
- [x] TikTok Commercial Content API connector (with mock fallback)
- [x] Andromeda Algorithm scoring engine (Format, Partnership, Duration scores)
- [x] Brand resolution (name → Meta Page ID + TikTok handle)
- [x] Competitor auto-suggest logic
- [x] tRPC routers: audit.create, audit.get, audit.list, brand.search, brand.resolve, competitor.suggest

## Phase 3: Frontend Core
- [x] Global theme and typography (dark premium design)
- [x] Home dashboard with brand search input
- [x] Recent audits list on home
- [x] Competitor selection step (auto-suggest + manual input)
- [x] Audit loading/progress state
- [x] Routing: /, /audit/new, /audit/:id, /share/:shareId

## Phase 4: Audit Dashboard UI
- [x] Audit header: brand name, Andromeda score, platform badges
- [x] Ad volume and spend range cards
- [x] Format mix chart (video/image/carousel donut)
- [x] Partnership breakdown chart (creator vs. branded vs. direct)
- [x] Andromeda score breakdown (3 sub-scores with progress bars)
- [x] Creator partnership gap analysis visualisation (30% benchmark line)
- [x] Competitor benchmarking table/chart
- [x] Creator gap analysis section (organic creators not in paid)
- [x] Andromeda radar chart

## Phase 5: Export & Sharing
- [x] PDF audit report generation (Tapline-branded HTML → PDF via Puppeteer)
- [x] Shareable audit link (unique URL → dynamic web view at /share/:shareId)
- [x] Share button with copy-to-clipboard

## Phase 6: Polish & Tests
- [x] Responsive design across all views
- [x] Loading skeletons and empty states
- [x] Vitest unit tests for Andromeda scoring engine (8 tests, all passing)
- [x] Vitest test for auth logout
- [x] Final checkpoint and delivery
