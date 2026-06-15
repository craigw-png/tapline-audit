import { PARTNERSHIP_BENCHMARK_PCT } from "@shared/const";

export interface AuditCardData {
  brandName: string;
  totalAds: number;
  partnershipAds: number;
  partnershipPct: number;
  partnershipConfirmed: boolean;
  /** e.g. "Meta · NL · last 30 days" */
  sourceLabel?: string;
}

const STATUS_COLOR = {
  below: "oklch(0.78 0.16 75)", // amber
  meets: "oklch(0.75 0.16 155)", // green
} as const;

function compute(data: AuditCardData) {
  const total = Math.max(0, Math.round(data.totalAds));
  const partnerships = Math.min(Math.max(0, Math.round(data.partnershipAds)), total);
  const pct = data.partnershipPct;
  const meets = pct >= PARTNERSHIP_BENCHMARK_PCT;
  const target = Math.ceil(total * (PARTNERSHIP_BENCHMARK_PCT / 100));
  const gap = Math.max(0, target - partnerships);
  const color = meets ? STATUS_COLOR.meets : STATUS_COLOR.below;

  // Track domain: always show 0..benchmark and the brand's bar with headroom.
  const domainMax = Math.max(50, Math.ceil(pct / 10) * 10);
  const fillPct = Math.min(100, (pct / domainMax) * 100);
  const markerPct = (PARTNERSHIP_BENCHMARK_PCT / domainMax) * 100;

  return { total, partnerships, pct, meets, gap, color, fillPct, markerPct };
}

/**
 * The single-image audit result, sized and styled to be screenshotted straight
 * into a LinkedIn post. The signature element is the benchmark track: the brand's
 * partnership share rendered against a hard 30% marker so the gap reads instantly.
 */
export function ResultCard({ data }: { data: AuditCardData }) {
  const c = compute(data);

  return (
    <div className="card-glow w-full max-w-[600px] rounded-2xl border border-border bg-card p-8 sm:p-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-[0.25em] text-primary">Humanz</span>
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Partnership Audit
        </span>
      </div>

      {/* Brand + period */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold sm:text-3xl">{data.brandName}</h2>
        {data.sourceLabel && (
          <p className="mt-1 text-sm text-muted-foreground">{data.sourceLabel}</p>
        )}
      </div>

      {/* Hero number */}
      <div className="mt-8 flex items-end gap-3">
        <span
          className="text-6xl font-bold leading-none tabular-nums sm:text-7xl"
          style={{ color: c.color }}
        >
          {c.pct}%
        </span>
        <span className="mb-1 max-w-[16rem] text-sm leading-snug text-muted-foreground">
          of {c.total} active ads carry a creator Paid Partnership label
        </span>
      </div>

      {/* Benchmark track — the signature element */}
      <div className="mt-9">
        <div className="relative h-3 w-full rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${c.fillPct}%`, backgroundColor: c.color }}
          />
          {/* 30% benchmark marker */}
          <div
            className="absolute inset-y-[-6px] w-0.5 bg-foreground/80"
            style={{ left: `${c.markerPct}%` }}
          />
        </div>
        <div className="relative mt-2 h-4">
          <span
            className="absolute -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wide text-foreground/80"
            style={{ left: `${c.markerPct}%` }}
          >
            30% benchmark
          </span>
        </div>
      </div>

      {/* Verdict */}
      <p className="mt-7 text-base leading-relaxed">
        {c.meets ? (
          <>
            <span className="font-semibold" style={{ color: c.color }}>
              At or above the 30% benchmark.
            </span>{" "}
            The next lever is creator mix and refresh cadence, not raw volume.
          </>
        ) : (
          <>
            <span className="font-semibold" style={{ color: c.color }}>
              {c.gap} {c.gap === 1 ? "ad" : "ads"} short of the 30% benchmark.
            </span>{" "}
            At this volume, {c.gap} more of {data.brandName}&apos;s {c.total} ads would need to run as
            creator partnerships.
          </>
        )}
      </p>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
        <span
          className="rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: data.partnershipConfirmed
              ? "oklch(0.75 0.16 155 / 0.15)"
              : "oklch(0.78 0.16 75 / 0.15)",
            color: data.partnershipConfirmed ? STATUS_COLOR.meets : STATUS_COLOR.below,
          }}
        >
          {data.partnershipConfirmed ? "Confirmed by Humanz" : "Provisional — pending review"}
        </span>
        <span className="text-xs text-muted-foreground">Source: Meta Ad Library</span>
      </div>
    </div>
  );
}
