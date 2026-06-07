/**
 * HaloEffect — SimilarWeb Traffic Intelligence Section
 *
 * On-demand: data is only fetched when the user clicks "Load Traffic Data".
 * Displays channel mix, visit trend, capture gap diagnostic, and competitor comparison.
 *
 * GUARDRAILS (shown in UI):
 * - SimilarWeb data is modelled, not measured. Directionally solid for high-traffic brands.
 * - "Social" channel does not cleanly isolate TikTok creator traffic.
 * - Correlation with creator activity is observational, not causal.
 */

import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Globe,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import type { SimilarWebData, CompetitorTrafficPoint } from "../types/audit";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HaloEffectProps {
  auditId: number;
  brandName: string;
  partnershipPct: number;
  andromedaScore: number;
  /** Pre-loaded data (from cache or previous load) */
  initialData?: SimilarWebData | null;
  initialDomain?: string | null;
  /** Competitor names for domain mapping */
  competitorNames?: string[];
}

// ─── Channel colour palette ────────────────────────────────────────────────────

const CHANNEL_COLORS = {
  direct: "#6366f1",
  organicSearch: "#10b981",
  paidSearch: "#f59e0b",
  social: "#ec4899",
  referral: "#8b5cf6",
  display: "#06b6d4",
  email: "#84cc16",
};

const CHANNEL_LABELS: Record<string, string> = {
  direct: "Direct",
  organicSearch: "Organic Search",
  paidSearch: "Paid Search",
  social: "Social",
  referral: "Referral",
  display: "Display",
  email: "Email",
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatVisits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatRank(n: number): string {
  if (n >= 1_000_000) return `#${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `#${(n / 1_000).toFixed(0)}K`;
  return `#${n}`;
}

function ConfidenceBadge({ tier, note }: { tier: "high" | "medium" | "low"; note: string }) {
  const colours = {
    high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const labels = { high: "High Confidence", medium: "Medium Confidence", low: "Low Confidence" };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${colours[tier]}`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        <strong>{labels[tier]}:</strong> {note}
      </span>
    </div>
  );
}

function GuardrailNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/40">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
      <span>
        SimilarWeb data is modelled, not measured. &ldquo;Social&rdquo; traffic does not cleanly
        isolate TikTok creator activity. Use for trend direction and channel shape — not precise
        attribution. Correlation with creator activity is observational.
      </span>
    </div>
  );
}

// ─── Capture Gap Card ──────────────────────────────────────────────────────────

function CaptureGapCard({ gap }: { gap: SimilarWebData["captureGap"] }) {
  if (!gap) return null;

  const severityConfig = {
    high: {
      bg: "bg-red-500/10 border-red-500/20",
      icon: <AlertTriangle className="h-5 w-5 text-red-400" />,
      badge: "bg-red-500/20 text-red-300",
      label: "High Severity",
    },
    medium: {
      bg: "bg-amber-500/10 border-amber-500/20",
      icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
      badge: "bg-amber-500/20 text-amber-300",
      label: "Medium Severity",
    },
    none: {
      bg: "bg-emerald-500/10 border-emerald-500/20",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
      badge: "bg-emerald-500/20 text-emerald-300",
      label: "No Gap Detected",
    },
  };

  const config = severityConfig[gap.severity];

  return (
    <Card className={`border ${config.bg} bg-transparent`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config.icon}
            <CardTitle className="text-base text-white">
              {gap.detected ? "Capture Gap Detected" : "Traffic Capture"}
            </CardTitle>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badge}`}>
            {config.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-xs text-white/50">Social Traffic Share</p>
            <p className="mt-1 text-2xl font-bold text-white">{gap.socialTrafficPct}%</p>
            <p className="text-xs text-white/40">of total website visits</p>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3">
            <p className="text-xs text-white/50">Capture Rate</p>
            <p className="mt-1 text-2xl font-bold text-white">{gap.captureRate}%</p>
            <p className="text-xs text-white/40">demand landing on own site</p>
          </div>
        </div>

        {/* Diagnosis */}
        <div className="rounded-lg bg-white/[0.03] p-3">
          <p className="text-xs font-medium text-white/70 mb-1">Diagnosis</p>
          <p className="text-sm text-white/60">{gap.diagnosis}</p>
        </div>

        {/* Recommendation */}
        {gap.detected && (
          <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3">
            <p className="text-xs font-medium text-indigo-300 mb-1">Recommendation</p>
            <p className="text-sm text-indigo-200/80">{gap.recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Channel Mix Donut-style bar ───────────────────────────────────────────────

function ChannelMixBar({ channelMix }: { channelMix: SimilarWebData["channelMix"] }) {
  if (!channelMix) return null;
  const channels = (Object.entries(channelMix) as [string, number][]).filter(([, v]) => v > 0);
  const total = channels.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-lg">
        {channels.map(([key, value]) => (
          <div
            key={key}
            style={{
              width: `${(value / total) * 100}%`,
              backgroundColor: CHANNEL_COLORS[key as keyof typeof CHANNEL_COLORS] ?? "#6b7280",
            }}
            title={`${CHANNEL_LABELS[key] ?? key}: ${value}%`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {channels.map(([key, value]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor: CHANNEL_COLORS[key as keyof typeof CHANNEL_COLORS] ?? "#6b7280",
              }}
            />
            <span className="text-xs text-white/60">
              {CHANNEL_LABELS[key] ?? key}{" "}
              <span className="font-semibold text-white/80">{value}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Competitor comparison table ───────────────────────────────────────────────

function CompetitorTrafficTable({
  brand,
  brandVisits,
  brandSocialPct,
  competitors,
}: {
  brand: string;
  brandVisits: number;
  brandSocialPct: number;
  competitors: NonNullable<SimilarWebData["competitorComparison"]>;
}) {
  const all = [
    { brandName: brand, latestMonthlyVisits: brandVisits, socialTrafficPct: brandSocialPct, isTarget: true },
    ...competitors.map((c: CompetitorTrafficPoint) => ({ ...c, isTarget: false })),
  ].sort((a, b) => b.latestMonthlyVisits - a.latestMonthlyVisits);

  const maxVisits = Math.max(...all.map((r) => r.latestMonthlyVisits));

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            <th className="px-4 py-3 text-left text-xs font-medium text-white/50">Brand</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-white/50">Monthly Visits</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-white/50">Social Traffic</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-white/50 hidden md:table-cell">
              Traffic Share
            </th>
          </tr>
        </thead>
        <tbody>
          {all.map((row, i) => {
            const pct = (row.latestMonthlyVisits / maxVisits) * 100;
            const vsTarget = row.isTarget
              ? null
              : row.latestMonthlyVisits > brandVisits
              ? "above"
              : "below";
            return (
              <tr
                key={i}
                className={`border-b border-white/5 last:border-0 ${
                  row.isTarget ? "bg-indigo-500/5" : "hover:bg-white/[0.02]"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${row.isTarget ? "text-indigo-300" : "text-white/80"}`}>
                      {row.brandName}
                    </span>
                    {row.isTarget && (
                      <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
                        Audited
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="font-mono text-white/80">{formatVisits(row.latestMonthlyVisits)}</span>
                    {vsTarget === "above" && <ArrowUpRight className="h-3.5 w-3.5 text-red-400" />}
                    {vsTarget === "below" && <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" />}
                    {vsTarget === null && <Minus className="h-3.5 w-3.5 text-white/30" />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={`font-mono ${
                      row.socialTrafficPct >= 15
                        ? "text-emerald-400"
                        : row.socialTrafficPct >= 8
                        ? "text-amber-400"
                        : "text-red-400"
                    }`}
                  >
                    {row.socialTrafficPct}%
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-indigo-500/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs text-white/40">{Math.round(pct)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function HaloEffect({
  auditId,
  brandName,
  partnershipPct,
  andromedaScore,
  initialData,
  initialDomain,
  competitorNames = [],
}: HaloEffectProps) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [data, setData] = useState<SimilarWebData | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMutation = trpc.halo.load.useMutation({
    onSuccess: (result) => {
      setData(result.data as SimilarWebData);
      setIsLoading(false);
      setError(null);
    },
    onError: (err) => {
      setIsLoading(false);
      setError(err.message);
    },
  });

  const handleLoad = () => {
    if (!domain.trim()) return;
    setIsLoading(true);
    setError(null);

    // Build competitor domain guesses from competitor names
    const competitorDomains = competitorNames.slice(0, 3).map((name) => ({
      brandName: name,
      domain: name.toLowerCase().replace(/[^a-z0-9]+/g, "") + ".co.uk",
    }));

    loadMutation.mutate({
      auditId,
      domain: domain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      competitorDomains,
    });
  };

  // ── Pre-load state ──────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Halo Effect — Traffic Intelligence</h2>
            <p className="mt-1 text-sm text-white/50">
              Complete the creation-to-conversion picture: does creator and ad activity actually
              land on the brand&apos;s own website?
            </p>
          </div>
          <Badge className="bg-indigo-500/10 text-indigo-300 border-indigo-500/20 text-xs">
            On-Demand
          </Badge>
        </div>

        {/* What this shows */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              icon: <Globe className="h-5 w-5 text-indigo-400" />,
              title: "Channel Mix",
              desc: "How traffic arrives — direct, organic search, paid search, social, referral. Shows whether creator activity is driving social traffic.",
            },
            {
              icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
              title: "Visit Trend",
              desc: "6-month monthly visit trend. Overlay with creator campaign activity to see if social and direct traffic move together.",
            },
            {
              icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
              title: "Capture Gap",
              desc: "Is creator-generated demand landing on the brand's own site — or leaking to Amazon, Argos, and TikTok Shop instead?",
            },
          ].map((item) => (
            <Card key={item.title} className="border-white/10 bg-white/[0.03]">
              <CardContent className="pt-5">
                <div className="mb-3">{item.icon}</div>
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="mt-1 text-xs text-white/50">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Domain input */}
        <Card className="border-white/10 bg-white/[0.03]">
          <CardContent className="pt-5">
            <div className="space-y-4">
              <div>
                <Label className="text-sm text-white/70">Brand Website Domain</Label>
                <p className="text-xs text-white/40 mt-0.5">
                  Enter the brand&apos;s primary website domain (e.g. <code>ninjahousehold.com</code>).
                  This triggers a SimilarWeb data pull — each pull uses Manus Data API credits.
                </p>
              </div>
              <div className="flex gap-3">
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. ninjahousehold.com"
                  className="flex-1 border-white/10 bg-white/[0.05] text-white placeholder:text-white/30 focus:border-indigo-500/50"
                  onKeyDown={(e) => e.key === "Enter" && handleLoad()}
                />
                <Button
                  onClick={handleLoad}
                  disabled={!domain.trim() || isLoading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-6"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <Globe className="mr-2 h-4 w-4" />
                      Load Traffic Data
                    </>
                  )}
                </Button>
              </div>
              {error && (
                <p className="text-xs text-red-400">
                  Failed to load traffic data: {error}. Using mock data as fallback.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <GuardrailNote />
      </div>
    );
  }

  // ── Loaded state ────────────────────────────────────────────────────────────

  // Build chart data from channelMixTrend
  const trendChartData = (data.channelMixTrend ?? []).map((m: { month: string; direct: number; organicSearch: number; paidSearch: number; social: number; referral: number; display: number; email: number }) => ({
    month: m.month.slice(0, 7),
    Direct: m.direct,
    "Organic Search": m.organicSearch,
    "Paid Search": m.paidSearch,
    Social: m.social,
    Referral: m.referral,
    Display: m.display,
    Email: m.email,
  }));

  // Visit volume chart
  const visitChartData = (data.monthlyVisitsTrend ?? []).map((v) => ({
    month: v.month.slice(0, 7),
    visits: v.visits,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Halo Effect — Traffic Intelligence</h2>
          <div className="mt-1 flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-white/40" />
            <span className="text-sm text-white/50">{data.domain}</span>
            {data.isMock && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                Mock Data
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setData(null)}
            className="border-white/10 text-white/60 hover:text-white text-xs"
          >
            Change Domain
          </Button>
          <span className="text-xs text-white/30">
            As of {new Date(data.dataAsOf).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Confidence badge */}
      <ConfidenceBadge tier={data.confidenceTier} note={data.confidenceNote} />

      {/* Top metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: "Monthly Visits",
            value: formatVisits(data.latestMonthlyVisits),
            sub: "latest month",
          },
          {
            label: "Global Rank",
            value: data.globalRank ? formatRank(data.globalRank) : "—",
            sub: "SimilarWeb rank",
          },
          {
            label: "Bounce Rate",
            value: data.bounceRate ? `${data.bounceRate}%` : "—",
            sub: "avg. session bounce",
          },
          {
            label: "Social Traffic",
            value: `${data.channelMix?.social ?? 0}%`,
            sub: "of total visits",
            highlight: (data.channelMix?.social ?? 0) < 10,
          },
        ].map((m) => (
          <Card key={m.label} className="border-white/10 bg-white/[0.03]">
            <CardContent className="pt-4">
              <p className="text-xs text-white/50">{m.label}</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  m.highlight ? "text-amber-400" : "text-white"
                }`}
              >
                {m.value}
              </p>
              <p className="text-xs text-white/30">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Capture gap */}
      {data.captureGap && <CaptureGapCard gap={data.captureGap} />}

      {/* Channel mix */}
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base text-white">Traffic Channel Mix</CardTitle>
          <p className="text-xs text-white/50">
            How visits arrive — averaged across the last 3 months. Social share reflects the
            proportion of traffic from social platforms (not exclusively creator-driven).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.channelMix && <ChannelMixBar channelMix={data.channelMix} />}
        </CardContent>
      </Card>

      {/* Channel trend chart */}
      {trendChartData.length > 0 && (
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base text-white">Channel Mix Trend — 6 Months</CardTitle>
            <p className="text-xs text-white/50">
              Overlay with creator campaign activity to identify whether social and direct traffic
              move in response to creator partnerships.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                {Object.entries(CHANNEL_COLORS).map(([key, color]) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={CHANNEL_LABELS[key] ?? key}
                    stackId="1"
                    stroke={color}
                    fill={color}
                    fillOpacity={0.6}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Visit volume trend */}
      {visitChartData.length > 0 && (
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base text-white">Monthly Visit Volume — 6 Months</CardTitle>
            <p className="text-xs text-white/50">
              Total estimated monthly visits. Spikes that align with creator campaign launches
              suggest positive halo effect.
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={visitChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                  tickFormatter={(v: number) => formatVisits(v)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a2e",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [formatVisits(v), "Visits"]}
                />
                <Bar dataKey="visits" radius={[4, 4, 0, 0]}>
                  {visitChartData.map((_: unknown, i: number) => (
                    <Cell
                      key={i}
                      fill={i === visitChartData.length - 1 ? "#6366f1" : "rgba(99,102,241,0.4)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Competitor comparison */}
      {data.competitorComparison && data.competitorComparison.length > 0 && (
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader>
            <CardTitle className="text-base text-white">Competitor Traffic Comparison</CardTitle>
            <p className="text-xs text-white/50">
              Monthly visit volume and social traffic share vs. competitors. Higher social % with
              strong creator programmes suggests the halo effect is working.
            </p>
          </CardHeader>
          <CardContent>
            <CompetitorTrafficTable
              brand={brandName}
              brandVisits={data.latestMonthlyVisits}
              brandSocialPct={data.channelMix?.social ?? 0}
              competitors={data.competitorComparison}
            />
          </CardContent>
        </Card>
      )}

      <GuardrailNote />
    </div>
  );
}
