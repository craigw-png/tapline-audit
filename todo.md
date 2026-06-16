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

## Phase 10: SimilarWeb Halo Effect Layer
- [x] Research SimilarWeb Data API via Manus built-in Data API
- [x] Add domain input field to brand search / audit creation flow
- [x] Extend brands table with domain column
- [x] Extend audits table with similarwebData JSON column
- [x] Build SimilarWeb connector with mock fallback (Ninja Kitchen UK: ninjahousehold.com)
- [x] Mock data: 6-month traffic trend, channel mix (direct/organic/paid/social/referral/display), monthly visits, confidence tier
- [x] Build capture gap diagnostic (high creator activity + low own-site social traffic = demand leaking to Amazon/TikTok Shop)
- [x] Build Halo Effect UI tab: channel mix stacked area chart, trend overlay with ad activity markers, capture gap callout, confidence flag
- [x] Confidence flag: high (>500K visits/mo), medium (50K–500K), low (<50K) — shown on all SimilarWeb data
- [x] Guardrail copy: "SimilarWeb is modelled, not measured — use for direction and trend, not precise attribution"
- [x] Write tests for SimilarWeb connector
- [x] Save checkpoint and deliver

## Phase 10: SimilarWeb Halo Effect (On-Demand)
- [x] Apply DB migration (domain column on brands, brandDomain + similarwebData on audits)
- [x] Build SimilarWeb connector using Manus Data API (visits, channel mix desktop+mobile, bounce rate, global rank)
- [x] Build capture gap diagnostic logic
- [x] Add domain input to audit creation flow (optional field)
- [x] Add on-demand tRPC procedure: audit.loadSimilarWeb — pulls live data, stores in similarwebData column
- [x] Build Halo Effect UI tab with "Load Traffic Data" button (not auto-pulled)
- [x] Channel mix stacked area chart (6-month trend)
- [x] Capture gap callout card with severity badge
- [x] Competitor traffic comparison table
- [x] Confidence tier badge + guardrail copy on all SimilarWeb data
- [x] Write tests for SimilarWeb connector (10 tests, all passing)
- [x] Save checkpoint and deliver
- [x] Add Live/Mock data source status badges to audit results page (TikTok, Meta, TikTok Shop sections)

## Phase 11: Real Creator Gap + Bold Header Stats
- [x] Build creatorGapBuilder.ts — extract real @mention creator handles from live Meta ad data
- [x] Wire creatorGapBuilder into audit.create procedure (uses real data when rawMetaAds available, mock fallback otherwise)
- [x] Redesign audit hero header: Total Ads + Partnership Ads as bold 3xl number cards
- [x] Fix TikTok test timeout (add 10s timeout to no-credentials test)
- [x] All 40 tests passing

## Phase 12: Creator Gap Data Integrity Fix
- [x] Fix creator gap: never show fabricated handles — use real Meta data or honest empty state
- [x] Show clear "Not enough data" state when real @mentions cannot be extracted from ad copy
- [x] Hide TikTok demo data from header stats and platform breakdown (show only when TikTok is live)
- [x] Make Meta Ads + Meta Partnership Ads the dominant hero numbers on the Overview (Meta-only label when TikTok is mock)
- [x] Remove mock creator handle fallback — show honest empty state instead

## Phase 13: UX Improvements
- [x] Add "View in Meta Ads Library" link on each candidate card (opens view_all_page_id URL)
- [x] Sort candidates by ad count descending (most active advertiser floats to top)
- [x] Add token expiry warning banner (shows when META_ACCESS_TOKEN is within 14 days of expiry)
- [x] Add quick-search suggestions on home page (Ninja Kitchen, HEMA, Dreame, Emma Sleep)
- [x] Add "Re-run Audit" button on audit results page
- [x] Add "View in Meta Ads Library" links on individual partnership ads in review list

## Phase 14: Brand Search Fix
- [x] Remove nameMatches filter that silently discarded all results when page names didn't match query
- [x] Fix ad_delivery_date_max to use yesterday (Meta rejects today's date with error 2334030)
- [x] Remove broken /pages/search and slug fallbacks (both require pages_read_engagement)
- [x] Return all deduped pages sorted by ad_count desc — user picks the right one from the list
- [x] Update META_ACCESS_TOKEN to new long-lived token (expires 2026-08-14)

## Phase 15: Manual Page ID Escape Hatch
- [x] Add "Can't find the right page?" collapsible section on candidate step
- [x] Allow user to paste a Facebook Page URL or numeric Page ID to bypass search
- [x] Increase candidate list limit from 5 to 8
