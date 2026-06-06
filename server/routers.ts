import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  upsertBrand,
  getBrandBySlug,
  searchBrands,
  createAudit,
  updateAudit,
  getAuditById,
  getAuditByShareId,
  listRecentAudits,
  createAuditCompetitors,
  getCompetitorsByAuditId,
} from "./db";
import { scoreAndromeda } from "./andromeda";
import {
  resolveBrandMock,
  getMockAdData,
  getCompetitorMocks,
  COMPETITOR_MOCKS,
} from "./mockData";
import { fetchBrandAdData } from "./apiConnectors";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Brand Router ──────────────────────────────────────────────────────────
  brand: router({
    /**
     * Search for brands by name — returns existing DB brands + mock suggestions.
     */
    search: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const dbResults = await searchBrands(input.query);
        const mockResolution = resolveBrandMock(input.query);
        const suggestions = [
          ...(mockResolution ? [mockResolution] : []),
          ...Object.values(COMPETITOR_MOCKS).map((c) => ({
            name: c.name,
            slug: c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            metaPageId: "",
            tiktokHandle: "",
            industry: "Kitchen Appliances",
            competitorSlugs: [],
          })),
        ];
        return { dbResults, suggestions: suggestions.slice(0, 6) };
      }),

    /**
     * Resolve a brand name to its Meta Page ID and TikTok handle.
     */
    resolve: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const mock = resolveBrandMock(input.query);
        if (!mock) return null;

        const brand = await upsertBrand({
          name: mock.name,
          slug: mock.slug,
          metaPageId: mock.metaPageId || null,
          tiktokHandle: mock.tiktokHandle || null,
          industry: mock.industry,
        });

        return {
          brand,
          competitorSuggestions: mock.competitorSlugs.map((slug) => {
            const comp = COMPETITOR_MOCKS[slug];
            return comp ? { name: comp.name, slug } : { name: slug, slug };
          }),
        };
      }),

    /**
     * Get a brand by slug.
     */
    get: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return getBrandBySlug(input.slug);
      }),
  }),

  // ─── Audit Router ──────────────────────────────────────────────────────────
  audit: router({
    /**
     * List recent completed audits for the home dashboard.
     */
    listRecent: publicProcedure.query(async () => {
      return listRecentAudits(12);
    }),

    /**
     * Get a single audit by its numeric ID.
     */
    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const audit = await getAuditById(input.id);
        if (!audit) return null;
        const competitors = await getCompetitorsByAuditId(input.id);
        return { audit, competitors };
      }),

    /**
     * Get an audit by its shareable ID (public).
     */
    getByShareId: publicProcedure
      .input(z.object({ shareId: z.string() }))
      .query(async ({ input }) => {
        const audit = await getAuditByShareId(input.shareId);
        if (!audit) return null;
        const competitors = await getCompetitorsByAuditId(audit.id);
        return { audit, competitors };
      }),

    /**
     * Create and run a new audit for a brand.
     * Uses mock data (live API integration to be wired in later).
     */
    create: publicProcedure
      .input(
        z.object({
          brandName: z.string().min(1),
          brandSlug: z.string().min(1),
          period: z.string().default("2026-05"),
          competitors: z.array(z.string()).max(5).default([]),
        })
      )
      .mutation(async ({ input }) => {
        // 1. Resolve or create brand
        let brand = await getBrandBySlug(input.brandSlug);
        if (!brand) {
          const mock = resolveBrandMock(input.brandName);
          brand = await upsertBrand({
            name: mock?.name ?? input.brandName,
            slug: input.brandSlug,
            metaPageId: mock?.metaPageId ?? null,
            tiktokHandle: mock?.tiktokHandle ?? null,
            industry: mock?.industry ?? "Consumer Goods",
          });
        }

        const brandId = brand?.id ?? 0;
        const shareId = nanoid(12);

        // 2. Create audit record (pending)
        const audit = await createAudit({
          shareId,
          brandId,
          brandName: input.brandName,
          period: input.period,
          platform: "combined",
          status: "processing",
          usedMockData: false,
        });

        if (!audit) throw new Error("Failed to create audit record");

        // 3. Fetch ad data (live API with mock fallback)
        const brandRecord = await getBrandBySlug(input.brandSlug);
        const adData = await fetchBrandAdData(
          input.brandSlug,
          input.brandName,
          brandRecord?.metaPageId,
          brandRecord?.tiktokHandle,
          input.period
        );
        const { meta, tiktok } = adData;
        const usedMockData = adData.usedMockData;
        const { creatorGap } = getMockAdData(input.brandSlug);

        // 4. Combine Meta + TikTok
        const totalAds = meta.totalAds + tiktok.totalAds;
        const partnershipAds = meta.partnershipAds + tiktok.partnershipAds;
        const formatBreakdown = {
          video: meta.formatBreakdown.video + tiktok.formatBreakdown.video,
          image: meta.formatBreakdown.image + tiktok.formatBreakdown.image,
          carousel: meta.formatBreakdown.carousel + tiktok.formatBreakdown.carousel,
          collection: meta.formatBreakdown.collection + tiktok.formatBreakdown.collection,
        };
        const avgDurationDays =
          (meta.avgDurationDays * meta.totalAds + tiktok.avgDurationDays * tiktok.totalAds) /
          Math.max(totalAds, 1);

        // 5. Score with Andromeda Algorithm
        const scores = scoreAndromeda({
          totalAds,
          partnershipAds,
          formatBreakdown,
          avgDurationDays,
        });

        // 6. Update audit with results
        const updatedAudit = await updateAudit(audit.id, {
          status: "complete",
          totalAds,
          partnershipAds,
          partnershipPct: scores.partnershipPct,
          estimatedSpendMin: meta.spendMin + tiktok.spendMin,
          estimatedSpendMax: meta.spendMax + tiktok.spendMax,
          estimatedImpressionsMin: meta.impressionsMin + tiktok.impressionsMin,
          estimatedImpressionsMax: meta.impressionsMax + tiktok.impressionsMax,
          andromedaScore: scores.andromedaScore,
          formatScore: scores.formatScore,
          partnershipScore: scores.partnershipScore,
          durationScore: scores.durationScore,
          formatBreakdown,
          metaAdsData: meta,
          tiktokAdsData: tiktok,
          creatorGapData: creatorGap,
          usedMockData,
        });

        // 7. Process competitors
        const competitorNames =
          input.competitors.length > 0
            ? input.competitors
            : ["KitchenAid UK", "Sage Appliances UK", "Instant Pot UK"];

        const competitorMocks = getCompetitorMocks(competitorNames);
        const competitorRows = competitorMocks.map((c) => ({
          auditId: audit.id,
          brandName: c.name,
          totalAds: c.totalAds,
          partnershipPct: c.partnershipPct,
          andromedaScore: c.andromedaScore,
          estimatedSpendMin: c.estimatedSpendMin,
          estimatedSpendMax: c.estimatedSpendMax,
          usedMockData: true,
        }));

        const competitors = await createAuditCompetitors(competitorRows);

        return {
          audit: updatedAudit,
          competitors,
          scores,
          shareId,
        };
      }),
  }),

  // ─── Competitor Suggestions ────────────────────────────────────────────────
  competitor: router({
    suggest: publicProcedure
      .input(z.object({ brandName: z.string(), industry: z.string().optional() }))
      .query(async ({ input }) => {
        const mock = resolveBrandMock(input.brandName);
        const slugs = mock?.competitorSlugs ?? ["kitchenaid", "sage", "instantpot"];
        return slugs.map((slug) => {
          const comp = COMPETITOR_MOCKS[slug];
          return comp ? { name: comp.name, slug } : { name: slug, slug };
        });
      }),
  }),
});

export type AppRouter = typeof appRouter;
