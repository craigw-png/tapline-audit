import { z } from "zod";
import { nanoid } from "nanoid";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  upsertBrand,
  getBrandBySlug,
  createAudit,
  updateAudit,
  getAuditById,
  getAuditByShareId,
  listRecentAudits,
} from "./db";
import {
  fetchBrandAdSnapshot,
  searchMetaPages,
  resolveMetaPageId,
  buildAdLibraryUrl,
  buildBrandedContentUrl,
} from "./metaConnector";
import { auditPartnership } from "./partnershipAudit";

/**
 * Humanz Partnership Audit — internal tool.
 *
 * Every data procedure is `protectedProcedure`: only logged-in Humanz team members
 * can run or read audits. (auth.me / logout stay public so the client can check
 * login state.) There is no public self-serve path, no email capture, no share
 * link, no competitor table, no TikTok, no SimilarWeb, no account-access flow.
 *
 * Two ways to produce an audit:
 *   - LIVE   : pull the Meta Ad Library snapshot, store a *candidate* partnership
 *              count, then a human confirms it via confirmPartnershipCount.
 *   - MANUAL : pass `manual: { totalAds, partnershipAds }` (counts read off the
 *              public Ad Library UI) — stored as confirmed immediately.
 *
 * Reporting/PDF should gate on `audit.partnershipConfirmed === true`.
 */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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

  // ─── Brand ───────────────────────────────────────────────────────────────────
  brand: router({
    /** Find candidate Meta Pages for a brand name so the user can confirm the right one. */
    resolveCandidates: protectedProcedure
      .input(z.object({ brandName: z.string().min(1) }))
      .query(async ({ input }) => {
        const candidates = await searchMetaPages(input.brandName, 5);
        return { candidates, hasLiveSearch: !!process.env.META_ACCESS_TOKEN };
      }),

    /** Lock in the confirmed Meta Page ID for a brand before auditing. */
    confirmPage: protectedProcedure
      .input(z.object({ brandName: z.string().min(1), metaPageId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const slug = slugify(input.brandName);
        const existing = await getBrandBySlug(slug);
        const brand = await upsertBrand({
          name: existing?.name ?? input.brandName,
          slug,
          metaPageId: input.metaPageId,
        });
        return { brand, slug };
      }),

    get: protectedProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => getBrandBySlug(input.slug)),
  }),

  // ─── Audit ─────────────────────────────────────────────────────────────────
  audit: router({
    listRecent: protectedProcedure.query(async () => listRecentAudits(20)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getAuditById(input.id)),

    getByShareId: protectedProcedure
      .input(z.object({ shareId: z.string() }))
      .query(async ({ input }) => getAuditByShareId(input.shareId)),

    /**
     * Run an audit. Live by default; manual if `manual` counts are supplied.
     * Returns a `dataState` the UI uses to decide what to render:
     *   "confirmed"   — manual counts, ready to report.
     *   "provisional" — live candidate count, awaiting human confirmation.
     *   "no_page"     — couldn't resolve a Meta Page; offer manual entry.
     *   "api_error"   — live fetch failed; offer manual entry via the library link.
     */
    create: protectedProcedure
      .input(
        z.object({
          brandName: z.string().min(1),
          brandSlug: z.string().min(1).optional(),
          metaPageId: z.string().optional(),
          countryCode: z.string().length(2).default("NL"),
          days: z.number().int().min(1).max(90).default(30),
          manual: z
            .object({
              totalAds: z.number().int().min(0),
              partnershipAds: z.number().int().min(0),
            })
            .optional(),
        })
      )
      .mutation(async ({ input }) => {
        const slug = slugify(input.brandSlug ?? input.brandName);
        let brand = await getBrandBySlug(slug);

        // Resolve a Meta Page ID (skip if manual — we don't need live data then).
        let metaPageId: string | null = input.metaPageId ?? brand?.metaPageId ?? null;
        if (!metaPageId && !input.manual) {
          metaPageId = await resolveMetaPageId(input.brandName);
        }

        // Upsert the brand record with the resolved page ID.
        if (!brand) {
          brand = await upsertBrand({ name: input.brandName, slug, metaPageId });
        } else if (metaPageId && metaPageId !== brand.metaPageId) {
          brand = await upsertBrand({ name: brand.name, slug, metaPageId });
        }
        const brandId = brand?.id ?? 0;

        const shareId = nanoid(12);
        const period = currentPeriod();
        const adLibraryUrl = metaPageId ? buildAdLibraryUrl(metaPageId, input.countryCode) : "";
        const brandedContentUrl = buildBrandedContentUrl(input.brandName, input.countryCode);

        // ── MANUAL PATH — counts read off the public Ad Library UI ───────────────
        if (input.manual) {
          const result = auditPartnership({
            brandName: input.brandName,
            totalAds: input.manual.totalAds,
            partnershipAds: input.manual.partnershipAds,
            source: "confirmed",
            periodLabel: `the last ${input.days} days`,
            countryCode: input.countryCode,
          });
          const audit = await createAudit({
            shareId,
            brandId,
            brandName: input.brandName,
            period,
            platform: "meta",
            status: "complete",
            totalAds: result.totalAds,
            partnershipAds: result.partnershipAds,
            partnershipPct: result.partnershipPct,
            partnershipConfirmed: true,
            adLibraryUrl,
            brandedContentUrl,
            metaIsMock: false,
            usedMockData: false,
          });
          return { audit, result, candidateAds: [], dataState: "confirmed" as const };
        }

        // ── No page resolved — let the user confirm a page or go manual ──────────
        if (!metaPageId) {
          const audit = await createAudit({
            shareId,
            brandId,
            brandName: input.brandName,
            period,
            platform: "meta",
            status: "error",
            brandedContentUrl,
          });
          return {
            audit,
            result: null,
            candidateAds: [],
            dataState: "no_page" as const,
            message:
              "Couldn't resolve a Meta Page for this brand. Confirm the page (brand.resolveCandidates) or enter counts manually.",
          };
        }

        // ── LIVE PATH ────────────────────────────────────────────────────────────
        const snap = await fetchBrandAdSnapshot({
          pageId: metaPageId,
          countryCode: input.countryCode,
          days: input.days,
        });

        if (!snap) {
          const audit = await createAudit({
            shareId,
            brandId,
            brandName: input.brandName,
            period,
            platform: "meta",
            status: "error",
            adLibraryUrl,
            brandedContentUrl,
          });
          return {
            audit,
            result: null,
            candidateAds: [],
            dataState: "api_error" as const,
            message: "Live Meta fetch failed. Open the Ad Library link and enter the counts manually.",
          };
        }

        const result = auditPartnership({
          brandName: input.brandName,
          totalAds: snap.totalAds,
          partnershipAds: snap.candidatePartnershipAds,
          source: "candidate",
          periodLabel: snap.periodLabel,
          countryCode: snap.countryCode,
        });

        const audit = await createAudit({
          shareId,
          brandId,
          brandName: input.brandName,
          period,
          platform: "meta",
          status: "complete",
          totalAds: result.totalAds,
          partnershipAds: result.partnershipAds, // candidate count until confirmed
          partnershipPct: result.partnershipPct,
          partnershipConfirmed: false,
          formatBreakdown: snap.formatBreakdown,
          metaAdsData: {
            totalAds: snap.totalAds,
            partnershipAds: snap.candidatePartnershipAds,
            formatBreakdown: snap.formatBreakdown,
            spendMin: 0,
            spendMax: 0,
            impressionsMin: 0,
            impressionsMax: 0,
            avgDurationDays: 0,
          },
          candidateAds: snap.candidateAds,
          adLibraryUrl: snap.adLibraryUrl,
          brandedContentUrl: snap.brandedContentUrl,
          metaIsMock: false,
          usedMockData: false,
        });

        return { audit, result, candidateAds: snap.candidateAds, dataState: "provisional" as const };
      }),

    /**
     * Confirm (or correct) the partnership count after a human checks the visible
     * Paid Partnership labels. Flips the audit to confirmed — only then should it
     * be exported / published.
     */
    confirmPartnershipCount: protectedProcedure
      .input(
        z.object({
          auditId: z.number(),
          confirmedPartnershipAds: z.number().int().min(0),
        })
      )
      .mutation(async ({ input }) => {
        const audit = await getAuditById(input.auditId);
        if (!audit) throw new Error("Audit not found");

        const result = auditPartnership({
          brandName: audit.brandName,
          totalAds: audit.totalAds ?? 0,
          partnershipAds: input.confirmedPartnershipAds,
          source: "confirmed",
        });

        const updated = await updateAudit(input.auditId, {
          partnershipAds: result.partnershipAds,
          partnershipPct: result.partnershipPct,
          partnershipConfirmed: true,
        });

        return { audit: updated, result };
      }),
  }),
});

export type AppRouter = typeof appRouter;
