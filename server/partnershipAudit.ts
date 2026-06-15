/**
 * Humanz Partnership Audit — the single, defensible metric.
 *
 * One question, one number: of a brand's active Meta ads, what share carry a
 * creator Paid Partnership label, versus the 30% benchmark?
 *
 * Design principles (deliberately narrow vs. the old multi-dimension engine):
 *   - The denominator (total active ads) comes from the Meta Ad Library API and
 *     is reliable for EU/UK pages.
 *   - The numerator (partnership ads) is NOT cleanly exposed by the paid API, so
 *     it is treated as a *confirmed* human input. The connector supplies a
 *     candidate count; a person verifies it against the visible Paid Partnership
 *     labels before anything is reported. `partnershipSource` records which it is.
 *   - No invented sub-scores, no "Entity ID collapse" certainty claims, no
 *     fabricated competitor benchmarks. Every number here can be defended in a
 *     sales conversation.
 */

/** The benchmark Humanz argues for: at least 30% of active ads should be creator partnerships. */
export const PARTNERSHIP_BENCHMARK = 0.3;

export type PartnershipSource = "confirmed" | "candidate";

export interface PartnershipAuditInput {
  brandName: string;
  totalAds: number;
  /** Partnership ad count. If `source` is "candidate" it is the heuristic estimate awaiting confirmation. */
  partnershipAds: number;
  source: PartnershipSource;
  /** "YYYY-MM" or a free-text window label like "last 30 days" */
  periodLabel?: string;
  countryCode?: string;
}

export interface PartnershipAuditResult {
  brandName: string;
  totalAds: number;
  partnershipAds: number;
  partnershipPct: number; // 0–100, rounded to 1 dp
  benchmarkPct: number; // 30
  status: "below" | "at" | "above";
  /** Additional partnership ads needed to reach the 30% benchmark at the current ad volume. */
  gapAds: number;
  /** Partnership ad count that would hit the benchmark exactly at the current volume. */
  targetPartnershipAds: number;
  source: PartnershipSource;
  /** True only when a human has confirmed the partnership count — gate reporting/PDF on this. */
  isConfirmed: boolean;
  headline: string;
  recommendation: string;
  periodLabel: string;
}

function clampPartnershipAds(partnershipAds: number, totalAds: number): number {
  if (!Number.isFinite(partnershipAds) || partnershipAds < 0) return 0;
  return Math.min(Math.round(partnershipAds), totalAds);
}

export function auditPartnership(input: PartnershipAuditInput): PartnershipAuditResult {
  const totalAds = Math.max(0, Math.round(input.totalAds));
  const partnershipAds = clampPartnershipAds(input.partnershipAds, totalAds);
  const periodLabel = input.periodLabel ?? "the last 30 days";

  const pctRaw = totalAds > 0 ? (partnershipAds / totalAds) * 100 : 0;
  const partnershipPct = Math.round(pctRaw * 10) / 10;

  const targetPartnershipAds = Math.ceil(totalAds * PARTNERSHIP_BENCHMARK);
  const gapAds = Math.max(0, targetPartnershipAds - partnershipAds);

  const status: PartnershipAuditResult["status"] =
    partnershipPct >= PARTNERSHIP_BENCHMARK * 100
      ? partnershipPct === PARTNERSHIP_BENCHMARK * 100
        ? "at"
        : "above"
      : "below";

  const isConfirmed = input.source === "confirmed";
  const where = input.countryCode ? ` in ${input.countryCode}` : "";

  const headline =
    totalAds === 0
      ? `No active Meta ads found for ${input.brandName}${where} in ${periodLabel}.`
      : `In ${periodLabel}, ${input.brandName} ran ${totalAds} active Meta ads${where}. ` +
        `${partnershipAds} (${partnershipPct}%) carry a creator Paid Partnership label — the benchmark is 30%.`;

  let recommendation: string;
  if (totalAds === 0) {
    recommendation = `No ads to assess for this window. Widen the date range or confirm the correct Meta Page.`;
  } else if (status === "below") {
    recommendation =
      `To reach the 30% benchmark at this ad volume, ${gapAds} more of ${input.brandName}'s ` +
      `${totalAds} ads would need to run as creator partnerships. ` +
      `Closing that gap puts more distinct creator identities into the auction — reach the brand's own page can't buy on its own.`;
  } else {
    recommendation =
      `${input.brandName} is already at or above the 30% partnership benchmark. ` +
      `The next lever is creator mix and refresh cadence, not raw partnership volume.`;
  }

  return {
    brandName: input.brandName,
    totalAds,
    partnershipAds,
    partnershipPct,
    benchmarkPct: PARTNERSHIP_BENCHMARK * 100,
    status,
    gapAds,
    targetPartnershipAds,
    source: input.source,
    isConfirmed,
    headline,
    recommendation,
    periodLabel,
  };
}
