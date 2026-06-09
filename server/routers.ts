import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
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
  createAccountAccess,
  getAccountAccessByBrandId,
  updateAccountAccess,
  listAccountAccess,
} from "./db";
import { scoreAndromeda } from "./andromeda";
import {
  resolveBrandMock,
  getMockAdData,
  getCompetitorMocks,
  COMPETITOR_MOCKS,
} from "./mockData";
import { fetchBrandAdData, searchMetaPages, resolveMetaPageId } from "./apiConnectors";
import { fetchAccountLevelData } from "./accountConnectors";
import { fetchTikTokShopIntelligence } from "./tiktokShopConnector";
import { fetchSimilarWebData, getMockSimilarWebData } from "./similarwebConnector";
import { notifyOwner } from "./_core/notification";

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

    resolve: publicProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(async ({ input }) => {
        // 1. Try mock resolution first (known brands with pre-set page IDs)
        const mock = resolveBrandMock(input.query);

        // 2. If no mock, attempt live Meta page resolution
        let metaPageId: string | null = mock?.metaPageId || null;
        let resolvedName = mock?.name ?? input.query;

        if (!metaPageId && process.env.META_ACCESS_TOKEN) {
          const livePageId = await resolveMetaPageId(input.query);
          if (livePageId) {
            metaPageId = livePageId;
            console.log(`[Brand Resolve] Live Meta page resolved: ${input.query} → ${livePageId}`);
          }
        }

        const slug = (mock?.slug ?? input.query.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim();

        const brand = await upsertBrand({
          name: resolvedName,
          slug,
          metaPageId: metaPageId,
          tiktokHandle: mock?.tiktokHandle || null,
          industry: mock?.industry ?? "Consumer Goods",
        });

        return {
          brand,
          competitorSuggestions: (mock?.competitorSlugs ?? []).map((s) => {
            const comp = COMPETITOR_MOCKS[s];
            return comp ? { name: comp.name, slug: s } : { name: s, slug: s };
          }),
          resolvedMetaPageId: metaPageId,
        };
      }),

    // Live Meta page search — used for brand search typeahead when token is available
    searchMetaPages: publicProcedure
      .input(z.object({ query: z.string().min(2) }))
      .query(async ({ input }) => {
        if (!process.env.META_ACCESS_TOKEN) return [];
        return searchMetaPages(input.query, 5);
      }),

    get: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => getBrandBySlug(input.slug)),
  }),

  // ─── Audit Router ──────────────────────────────────────────────────────────
  audit: router({
    listRecent: publicProcedure.query(async () => listRecentAudits(12)),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const audit = await getAuditById(input.id);
        if (!audit) return null;
        const competitors = await getCompetitorsByAuditId(input.id);
        return { audit, competitors };
      }),

    getByShareId: publicProcedure
      .input(z.object({ shareId: z.string() }))
      .query(async ({ input }) => {
        const audit = await getAuditByShareId(input.shareId);
        if (!audit) return null;
        const competitors = await getCompetitorsByAuditId(audit.id);
        return { audit, competitors };
      }),

    create: publicProcedure
      .input(
        z.object({
          brandName: z.string().min(1),
          brandSlug: z.string().min(1),
          period: z.string().default("2026-05"),
          competitors: z.array(z.string()).max(5).default([]),
          brandDomain: z.string().optional(),
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
          brandDomain: input.brandDomain ?? null,
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
        const metaIsMock = adData.metaIsMock;
        const tiktokIsMock = adData.tiktokIsMock;

        // Persist resolved Meta page ID if it was discovered during this audit
        if (adData.resolvedMetaPageId && !brandRecord?.metaPageId && brandId) {
          await upsertBrand({
            name: input.brandName,
            slug: input.brandSlug,
            metaPageId: adData.resolvedMetaPageId,
          });
          console.log(`[Audit] Persisted resolved Meta page ID ${adData.resolvedMetaPageId} for ${input.brandName}`);
        }
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

        // 5. Score with Andromeda Readiness Algorithm (4-dimension)
        const scores = scoreAndromeda({
          totalAds,
          partnershipAds,
          formatBreakdown,
          avgDurationDays,
        });

        // 6. Fetch TikTok Shop Intelligence
        const tiktokShopData = await fetchTikTokShopIntelligence(
          input.brandName,
          input.competitors,
          "GB"
        );

        // 7. Check for account-level access
        const accessGrant = brandId ? await getAccountAccessByBrandId(brandId) : null;
        let accountLevelData = null;
        let hasAccountData = false;

        if (
          accessGrant?.status === "active" &&
          (accessGrant.metaAdAccountId || accessGrant.tiktokAdvertiserId)
        ) {
          accountLevelData = await fetchAccountLevelData({
            metaAdAccountId: accessGrant.metaAdAccountId,
            tiktokAdvertiserId: accessGrant.tiktokAdvertiserId,
            period: input.period,
          });
          hasAccountData = accountLevelData !== null;
        }

        // 8. Update audit with results
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
          conceptScore: scores.conceptScore,
          estimatedConcepts: scores.estimatedConcepts,
          entityIdRisk: scores.entityIdRisk,
          formatBreakdown,
          metaAdsData: meta,
          tiktokAdsData: tiktok,
          creatorGapData: creatorGap,
          tiktokShopData,
          usedMockData,
          metaIsMock,
          tiktokIsMock,
          hasAccountData,
          ...(accountLevelData
            ? {
                ftiScore: accountLevelData.ftiScore,
                ctrPct: accountLevelData.ctrPct,
                thumbStopRate: accountLevelData.thumbStopRate,
                holdRate: accountLevelData.holdRate,
                cpaDeltaPct: accountLevelData.cpaDeltaPct,
                creativeSimilarityScore: accountLevelData.creativeSimilarityScore,
                accountLevelData,
              }
            : {}),
        });

        // 9. Process competitors
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
          hasAccountData,
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

  // ─── Account Access Router ─────────────────────────────────────────────────
  accountAccess: router({
    /**
     * Request account-level access for a brand.
     * Sends Tapline the brand's contact email and account IDs.
     * The brand will receive step-by-step instructions to grant
     * read-only Analyst/Viewer access.
     */
    request: publicProcedure
      .input(
        z.object({
          brandName: z.string().min(1),
          brandSlug: z.string().min(1),
          contactEmail: z.string().email(),
          metaAdAccountId: z.string().optional(),
          tiktokAdvertiserId: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Resolve brand
        let brand = await getBrandBySlug(input.brandSlug);
        if (!brand) {
          brand = await upsertBrand({
            name: input.brandName,
            slug: input.brandSlug,
          });
        }

        const brandId = brand?.id ?? 0;

        // Set expiry to 90 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90);

        const accessRecord = await createAccountAccess({
          brandId,
          brandName: input.brandName,
          contactEmail: input.contactEmail,
          status: "requested",
          metaAdAccountId: input.metaAdAccountId ?? null,
          tiktokAdvertiserId: input.tiktokAdvertiserId ?? null,
          notes: input.notes ?? null,
          expiresAt,
        });

        // Notify the Tapline team
        await notifyOwner({
          title: `New Account Access Request: ${input.brandName}`,
          content: `Brand: ${input.brandName}\nContact: ${input.contactEmail}\nMeta Account: ${input.metaAdAccountId ?? "not provided"}\nTikTok Advertiser: ${input.tiktokAdvertiserId ?? "not provided"}\nNotes: ${input.notes ?? "none"}`,
        });

        return {
          success: true,
          accessId: accessRecord?.id,
          expiresAt,
          instructions: buildAccessInstructions(input.metaAdAccountId, input.tiktokAdvertiserId),
        };
      }),

    /**
     * Get the current access status for a brand.
     */
    getStatus: publicProcedure
      .input(z.object({ brandSlug: z.string() }))
      .query(async ({ input }) => {
        const brand = await getBrandBySlug(input.brandSlug);
        if (!brand) return null;
        return getAccountAccessByBrandId(brand.id);
      }),

    /**
     * Confirm that access has been granted (brand notifies Tapline).
     */
    confirmGrant: publicProcedure
      .input(
        z.object({
          accessId: z.number(),
          metaGranted: z.boolean().default(false),
          tiktokGranted: z.boolean().default(false),
          metaAdAccountId: z.string().optional(),
          tiktokAdvertiserId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const updated = await updateAccountAccess(input.accessId, {
          status: "pending",
          metaAccessGranted: input.metaGranted,
          tiktokAccessGranted: input.tiktokGranted,
          ...(input.metaAdAccountId ? { metaAdAccountId: input.metaAdAccountId } : {}),
          ...(input.tiktokAdvertiserId ? { tiktokAdvertiserId: input.tiktokAdvertiserId } : {}),
        });

        await notifyOwner({
          title: `Access Grant Confirmed — Verify Now`,
          content: `Access ID ${input.accessId} has been confirmed by the brand. Meta: ${input.metaGranted}, TikTok: ${input.tiktokGranted}. Please verify and activate.`,
        });

        return { success: true, record: updated };
      }),

    /**
     * Admin: list all access requests.
     */
    list: protectedProcedure.query(async () => listAccountAccess()),
  }),

  // ─── SimilarWeb Halo Effect (On-Demand) ───────────────────────────────────
  halo: router({
    /**
     * On-demand: pull SimilarWeb traffic data for an audit.
     * Only called when the user explicitly clicks "Load Traffic Data".
     * Stores the result in the audit's similarwebData column.
     */
    load: publicProcedure
      .input(
        z.object({
          auditId: z.number(),
          domain: z.string().min(3),
          competitorDomains: z
            .array(z.object({ brandName: z.string(), domain: z.string() }))
            .max(3)
            .default([]),
        })
      )
      .mutation(async ({ input }) => {
        const audit = await getAuditById(input.auditId);
        if (!audit) throw new Error("Audit not found");

        const partnershipPct = audit.partnershipPct ?? 0;
        const andromedaScore = audit.andromedaScore ?? 0;

        const data = await fetchSimilarWebData({
          domain: input.domain,
          partnershipPct,
          andromedaScore,
          competitorDomains: input.competitorDomains,
        });

        // Persist to the audit record
        await updateAudit(input.auditId, {
          brandDomain: input.domain,
          similarwebData: data,
        });

        // Also persist domain to the brand record
        if (audit.brandId) {
          const brand = await getBrandBySlug(
            audit.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")
          );
          if (brand) {
            await upsertBrand({
              name: brand.name,
              slug: brand.slug ?? "",
              domain: input.domain,
            });
          }
        }

        return { success: true, data };
      }),

    /**
     * Get cached SimilarWeb data for an audit (no API call).
     */
    getCached: publicProcedure
      .input(z.object({ auditId: z.number() }))
      .query(async ({ input }) => {
        const audit = await getAuditById(input.auditId);
        if (!audit) return null;
        return {
          domain: audit.brandDomain,
          data: audit.similarwebData,
        };
      }),

    /**
     * Preview mock data for a domain (no API call, no credits).
     * Used to show the UI shape before the user loads real data.
     */
    preview: publicProcedure
      .input(
        z.object({
          domain: z.string().min(3),
          partnershipPct: z.number().default(0),
          andromedaScore: z.number().default(0),
        })
      )
      .query(({ input }) =>
        getMockSimilarWebData(input.domain, input.partnershipPct, input.andromedaScore)
      ),
  }),
});

/**
 * Build step-by-step access instructions for the brand.
 * Returns platform-specific instructions based on what account IDs were provided.
 */
function buildAccessInstructions(
  metaAdAccountId?: string,
  tiktokAdvertiserId?: string
): {
  meta?: string[];
  tiktok?: string[];
  summary: string;
} {
  const meta = metaAdAccountId
    ? [
        "Log in to Meta Business Manager (business.facebook.com)",
        "Go to Business Settings → Users → Partners",
        "Click 'Add' and enter the Tapline partner business ID: 123456789 (we will confirm this by email)",
        "Under 'Assign Assets', select your Ad Account",
        "Set the role to 'Analyst' — this is view-only and cannot create, edit, or spend",
        "Click 'Save Changes'",
        "The access will automatically expire after 90 days — you can revoke it at any time from Business Settings",
      ]
    : undefined;

  const tiktok = tiktokAdvertiserId
    ? [
        "Log in to TikTok Ads Manager (ads.tiktok.com)",
        "Go to Account → User Management → Members",
        "Click 'Add Member' and enter the Tapline email: audit@tapline.co",
        "Set the role to 'Viewer' — this is read-only and cannot create, edit, or spend",
        "Set an access expiry of 90 days",
        "Click 'Confirm'",
        "You can remove access at any time from User Management",
      ]
    : undefined;

  const platforms = [meta ? "Meta" : null, tiktok ? "TikTok" : null]
    .filter(Boolean)
    .join(" and ");

  return {
    meta,
    tiktok,
    summary: `We have sent you an email with these instructions. Once you have granted ${platforms} access, click the 'I've Granted Access' button below and we will verify the connection within 24 hours. Your access grant is read-only — Tapline cannot create, edit, pause, or spend on any of your campaigns.`,
  };
}

export type AppRouter = typeof appRouter;
