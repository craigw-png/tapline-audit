import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Zap, ExternalLink, BarChart3, Users, TrendingUp, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { Audit, AuditCompetitor } from "@/types/audit";

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

function fmtCurrency(n: number) {
  if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `£${(n / 1000).toFixed(0)}K`;
  return `£${n}`;
}

function getGrade(score: number) {
  if (score >= 80) return { grade: "A", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" };
  if (score >= 65) return { grade: "B", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" };
  if (score >= 50) return { grade: "C", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30" };
  if (score >= 35) return { grade: "D", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" };
  return { grade: "F", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" };
}

function ScoreRing({ score, size = 100 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const { grade, color } = getGrade(score);
  const strokeColor =
    score >= 70 ? "oklch(0.75 0.16 155)" : score >= 50 ? "oklch(0.78 0.16 75)" : "oklch(0.62 0.22 25)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(0.22 0.015 264)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="score-ring"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${color}`}>{grade}</span>
        <span className="text-xs font-semibold">{score}</span>
      </div>
    </div>
  );
}

export default function SharePage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [, navigate] = useLocation();

  const { data, isLoading } = trpc.audit.getByShareId.useQuery(
    { shareId: shareId ?? "" },
    { enabled: !!shareId }
  );

  const audit = data?.audit as Audit | undefined;
  const competitors = (data?.competitors ?? []) as AuditCompetitor[];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background grid-bg">
        <header className="border-b border-border/50 h-14" />
        <div className="container py-8 max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="min-h-screen bg-background grid-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Audit report not found or has been removed.</p>
          <Button onClick={() => navigate("/")} variant="outline">Go to Tapline</Button>
        </div>
      </div>
    );
  }

  const andromedaScore = audit.andromedaScore ?? 0;
  const partnershipPct = ((audit.partnershipPct ?? 0) * 100).toFixed(1);
  const { grade, color: gradeColor, bg: gradeBg } = getGrade(andromedaScore);

  const formatData = audit.formatBreakdown
    ? [
        { name: "Video", value: audit.formatBreakdown.video, color: "oklch(0.72 0.18 280)" },
        { name: "Image", value: audit.formatBreakdown.image, color: "oklch(0.68 0.16 200)" },
        { name: "Carousel", value: audit.formatBreakdown.carousel, color: "oklch(0.75 0.14 150)" },
        { name: "Collection", value: audit.formatBreakdown.collection, color: "oklch(0.78 0.16 50)" },
      ].filter((d) => d.value > 0)
    : [];

  const gapData = [
    { name: audit.brandName, value: parseFloat(partnershipPct) },
    ...competitors.map((c) => ({ name: c.brandName, value: c.partnershipPct ?? 0 })),
  ];

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-base">Tapline</span>
            <Badge variant="secondary" className="text-[10px] ml-1">Shared Report</Badge>
          </div>
          <Button size="sm" onClick={() => navigate("/")} className="gap-1.5 btn-glow">
            <ExternalLink className="w-3.5 h-3.5" />
            Run Your Own Audit
          </Button>
        </div>
      </header>

      <main className="container py-8 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="glass rounded-2xl p-6 mb-6 card-glow">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">{audit.period}</Badge>
                {audit.usedMockData && <Badge variant="secondary" className="text-xs">Demo Data</Badge>}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">{audit.brandName}</h1>
              <p className="text-muted-foreground text-sm mb-4">
                Creator Partnership Audit · {audit.totalAds ?? 0} ads analysed
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Est. Spend</p>
                  <p className="font-semibold text-sm">
                    {fmtCurrency(audit.estimatedSpendMin ?? 0)} – {fmtCurrency(audit.estimatedSpendMax ?? 0)}
                  </p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Impressions</p>
                  <p className="font-semibold text-sm">
                    {fmt(audit.estimatedImpressionsMin ?? 0)} – {fmt(audit.estimatedImpressionsMax ?? 0)}
                  </p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Partnership Ads</p>
                  <p className="font-semibold text-sm">{partnershipPct}%</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <ScoreRing score={andromedaScore} size={110} />
                <p className="text-xs text-muted-foreground mt-2">Andromeda Score</p>
              </div>
              <div className={`px-4 py-3 rounded-xl border ${gradeBg} text-center`}>
                <p className={`text-4xl font-bold ${gradeColor}`}>{grade}</p>
                <p className="text-xs text-muted-foreground mt-1">Grade</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Ads", value: audit.totalAds ?? 0, icon: BarChart3, color: "text-blue-400" },
            {
              label: "Partnership %",
              value: `${partnershipPct}%`,
              icon: Users,
              color: parseFloat(partnershipPct) >= 30 ? "text-emerald-400" : "text-red-400",
            },
            { label: "Format Score", value: audit.formatScore ?? 0, icon: Target, color: "text-primary" },
            { label: "Duration Score", value: audit.durationScore ?? 0, icon: TrendingUp, color: "text-primary" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Format Mix */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Format Mix
            </h3>
            {formatData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={140} height={140}>
                  <PieChart>
                    <Pie data={formatData} cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} dataKey="value">
                      {formatData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {formatData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                        <span className="text-sm">{d.name}</span>
                      </div>
                      <span className="text-sm font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No format data.</p>
            )}
          </div>

          {/* Partnership Gap */}
          <div className="glass rounded-2xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Partnership Gap
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={gapData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 264)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "oklch(0.58 0.02 264)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "oklch(0.58 0.02 264)", fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 60]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Partnership Ads"]}
                  contentStyle={{ background: "oklch(0.14 0.012 264)", border: "1px solid oklch(0.22 0.015 264)", borderRadius: "8px" }}
                />
                <ReferenceLine y={30} stroke="oklch(0.78 0.16 75)" strokeDasharray="6 3" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {gapData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "oklch(0.72 0.18 280)" : "oklch(0.68 0.16 200)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CTA */}
        <div className="glass rounded-2xl p-6 text-center card-glow">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-xs text-primary mb-4">
            <Zap className="w-3 h-3" />
            Powered by Tapline
          </div>
          <h2 className="text-xl font-bold mb-2">Want to audit your brand?</h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            Tapline analyses your Meta and TikTok ad strategy, scores your creative diversity, and identifies creator partnership gaps — in seconds.
          </p>
          <Button onClick={() => navigate("/")} size="lg" className="btn-glow">
            Run a Free Audit
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </main>

      <footer className="border-t border-border/50 mt-12">
        <div className="container py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 Tapline. All rights reserved.</span>
          <span>Powered by the Andromeda Algorithm</span>
        </div>
      </footer>
    </div>
  );
}
