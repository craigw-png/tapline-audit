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

## Phase 7: Score Restructure + Account-Level Audit Tier
- [x] Rename Andromeda sub-scores: Format Diversity Index, Creator Signal Score, Creative Freshness Score
- [x] Add 4th sub-score: Volume-to-Concept Ratio (concept concentration heuristic)
- [x] Update score weights: 25% format, 40% partnership, 15% duration, 20% concept ratio
- [x] Add Entity ID concentration risk flag to scoring engine and schema
- [x] Extend audit schema with account-level metrics columns (CTR, thumbStopRate, holdRate, cpaDelta, ftiScore, creativeSimilarityScore)
- [x] Build Meta Marketing API connector (ads_read scope) for account-level data
- [x] Build TikTok Ads API connector for account-level data
- [x] Add account_access table and tRPC procedures for managing client access grants
- [x] Build Account Access onboarding UI with step-by-step instructions
- [x] Add access level badge to audit dashboard (Public vs Account-Level)
- [x] Add account-level metrics section to audit dashboard (FTI gauge, CTR, thumb-stop, hold rate, CPA delta)
- [x] Update PDF export to include account-level section when available
- [x] Update Andromeda scoring tests
- [x] Save checkpoint and deliver

## Phase 8: Meta Ads Library API Integration
- [x] Research Meta Ads Library API endpoints and data shape
- [x] Build real Meta Ads Library connector with pagination, real partnership detection, real format detection
- [x] Update brand resolution to search real Meta Page IDs via API (live page search + persist resolved IDs)
- [x] Update audit.create to use live data when token is present, mock as fallback
- [x] Add META_ACCESS_TOKEN secret (token valid, awaiting Meta identity verification for ads_library access)
- [x] Token validation test passes — Ads Library query awaiting Meta app verification (error 2332002)
- [x] Save checkpoint and deliver

## Phase 9: TikTok Shop Intelligence Layer
- [x] Research TikTok Creative Center API endpoints and auth
- [x] Build TikTok Creative Center connector (top creators by GMV, trending products, top Shop videos) — unofficial Creative Center endpoints + rich mock fallback
- [x] Extend schema with tiktokShopData JSON column on audits
- [x] Build TikTok Shop Intelligence UI section in audit dashboard — new TikTok Shop tab with creator GMV table, trending products, top videos, shop presence comparison
- [x] Mock data: kitchen appliances, beauty, fashion categories — UK market
- [x] Write tests for the new connector (10 tests, all passing)
- [x] Save checkpoint and deliver
