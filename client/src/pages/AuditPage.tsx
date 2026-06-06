import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  Zap,
  Share2,
  Download,
  TrendingUp,
  Users,
  BarChart3,
  Target,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ReferenceLine,
} from "recharts";
import type { Audit, AuditCompetitor, CreatorGapData } from "@/types/audit";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function getGrade(score: number): { grade: string; color: string; bg: string } {
  if (score >= 80) return { grade: "A", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30" };
  if (score >= 65) return { grade: "B", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/30" };
  if (score >= 50) return { grade: "C", color: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30" };
  if (score >= 35) return { grade: "D", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/30" };
  return { grade: "F", color: "text-red-400", bg: "bg-red-400/10 border-red-400/30" };
}

// ─── Andromeda Score Ring ─────────────────────────────────────────────────────

function ScoreRing({ score, size = 120, label }: { score: number; size?: number; label?: string }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const { grade, color } = getGrade(score);
  const strokeColor =
    score >= 70 ? "oklch(0.75 0.16 155)" : score >= 50 ? "oklch(0.78 0.16 75)" : "oklch(0.62 0.22 25)";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(0.22 0.015 264)" strokeWidth={8} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={8}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="score-ring"
            style={{ filter: `drop-shadow(0 0 8px ${strokeColor})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${color}`}>{grade}</span>
          <span className="text-sm font-semibold text-foreground">{score}</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground text-center">{label}</span>}
    </div>
  );
}

// ─── Sub-score Bar ────────────────────────────────────────────────────────────

function SubScoreBar({ label, score, description }: { label: string; score: number; description: string }) {
  const color =
    score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold tabular-nums">{score}/100</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

// ─── Creator Card ─────────────────────────────────────────────────────────────

function CreatorCard({ creator }: { creator: CreatorGapData["organicCreators"][0] }) {
  const platformColor = creator.platform === "tiktok" ? "text-pink-400" : "text-blue-400";
  return (
    <div className={`glass rounded-xl p-4 ${creator.inPaidPartnership ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-sm">{creator.handle}</p>
          <p className={`text-xs ${platformColor} capitalize`}>{creator.platform}</p>
        </div>
        {creator.inPaidPartnership ? (
          <Badge variant="secondary" className="text-[10px]">Paid Partner</Badge>
        ) : (
          <Badge className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">Gap Opportunity</Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Followers</p>
          <p className="text-sm font-semibold">{fmt(creator.followers)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Engagement</p>
          <p className="text-sm font-semibold">{creator.avgEngagement.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Mentions</p>
          <p className="text-sm font-semibold">{creator.brandMentions}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Audit Page ──────────────────────────────────────────────────────────

export default function AuditPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.audit.get.useQuery(
    { id: parseInt(id ?? "0") },
    { enabled: !!id }
  );

  const audit = data?.audit as Audit | undefined;
  const competitors = (data?.competitors ?? []) as AuditCompetitor[];

  const handleCopyShare = () => {
    if (!audit) return;
    const url = `${window.location.origin}/share/${audit.shareId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Share link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = () => {
    if (!audit) return;
    window.open(`/api/audit/${audit.id}/pdf`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background grid-bg">
        <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm h-14" />
        <div className="container py-8 max-w-6xl mx-auto space-y-6">
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
          <p className="text-muted-foreground mb-4">Audit not found.</p>
          <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
        </div>
      </div>
    );
  }

  const andromedaScore = audit.andromedaScore ?? 0;
  const formatScore = audit.formatScore ?? 0;
  const partnershipScore = audit.partnershipScore ?? 0;
  const durationScore = audit.durationScore ?? 0;
  const partnershipPct = ((audit.partnershipPct ?? 0) * 100).toFixed(1);
  const { grade, color: gradeColor, bg: gradeBg } = getGrade(andromedaScore);

  // Format breakdown for donut chart
  const formatData = audit.formatBreakdown
    ? [
        { name: "Video", value: audit.formatBreakdown.video, color: "oklch(0.72 0.18 280)" },
        { name: "Image", value: audit.formatBreakdown.image, color: "oklch(0.68 0.16 200)" },
        { name: "Carousel", value: audit.formatBreakdown.carousel, color: "oklch(0.75 0.14 150)" },
        { name: "Collection", value: audit.formatBreakdown.collection, color: "oklch(0.78 0.16 50)" },
      ].filter((d) => d.value > 0)
    : [];

  // Partnership gap data
  const gapData = [
    { name: audit.brandName, value: parseFloat(partnershipPct), fill: "oklch(0.72 0.18 280)" },
    ...competitors.map((c) => ({
      name: c.brandName,
      value: c.partnershipPct ?? 0,
      fill: "oklch(0.68 0.16 200)",
    })),
  ];

  // Andromeda radar data
  const radarData = [
    { subject: "Format", A: formatScore, fullMark: 100 },
    { subject: "Partnership", A: partnershipScore, fullMark: 100 },
    { subject: "Duration", A: durationScore, fullMark: 100 },
  ];

  const creatorGap = audit.creatorGapData;
  const gapCreators = creatorGap?.organicCreators.filter((c) => !c.inPaidPartnership) ?? [];

  return (
    <div className="min-h-screen bg-background grid-bg" ref={reportRef}>
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm">Tapline</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {audit.usedMockData && (
              <Badge variant="secondary" className="text-[10px]">Demo Data</Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleCopyShare} className="gap-1.5">
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Share"}
            </Button>
            <Button size="sm" onClick={handleDownloadPDF} className="gap-1.5 btn-glow">
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="glass rounded-2xl p-6 mb-6 card-glow">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Brand info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {audit.period}
                </Badge>
                <Badge variant="secondary" className="text-xs capitalize">
                  {audit.platform}
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">{audit.brandName}</h1>
              <p className="text-muted-foreground text-sm">
                Creator Partnership Audit · {audit.totalAds ?? 0} ads analysed
              </p>
              <div className="flex items-center gap-4 mt-4">
                <div>
                  <p className="text-xs text-muted-foreground">Est. Spend</p>
                  <p className="font-semibold text-sm">
                    {fmtCurrency(audit.estimatedSpendMin ?? 0)} – {fmtCurrency(audit.estimatedSpendMax ?? 0)}
                  </p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Est. Impressions</p>
                  <p className="font-semibold text-sm">
                    {fmt(audit.estimatedImpressionsMin ?? 0)} – {fmt(audit.estimatedImpressionsMax ?? 0)}
                  </p>
                </div>
                <div className="w-px h-8 bg-border" />
                <div>
                  <p className="text-xs text-muted-foreground">Partnership Ads</p>
                  <p className="font-semibold text-sm">
                    {audit.partnershipAds ?? 0} / {audit.totalAds ?? 0} ({partnershipPct}%)
                  </p>
                </div>
              </div>
            </div>

            {/* Andromeda Score */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <ScoreRing score={andromedaScore} size={130} />
                <p className="text-xs text-muted-foreground mt-2">Andromeda Score</p>
              </div>
              <div className={`px-4 py-3 rounded-xl border ${gradeBg} text-center`}>
                <p className={`text-4xl font-bold ${gradeColor}`}>{grade}</p>
                <p className="text-xs text-muted-foreground mt-1">Grade</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Total Ads",
              value: audit.totalAds ?? 0,
              icon: BarChart3,
              color: "text-blue-400",
              sub: `${audit.metaAdsData?.totalAds ?? 0} Meta · ${audit.tiktokAdsData?.totalAds ?? 0} TikTok`,
            },
            {
              label: "Partnership Ads",
              value: `${partnershipPct}%`,
              icon: Users,
              color: parseFloat(partnershipPct) >= 30 ? "text-emerald-400" : "text-red-400",
              sub: `Target: 30%+`,
            },
            {
              label: "Format Score",
              value: formatScore,
              icon: Target,
              color: formatScore >= 70 ? "text-emerald-400" : "text-amber-400",
              sub: "Creative diversity",
            },
            {
              label: "Duration Score",
              value: durationScore,
              icon: TrendingUp,
              color: durationScore >= 70 ? "text-emerald-400" : "text-amber-400",
              sub: "Freshness / fatigue",
            },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Main content tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-card border border-border h-10">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="andromeda" className="text-xs">Andromeda Score</TabsTrigger>
            <TabsTrigger value="creators" className="text-xs">Creator Gap</TabsTrigger>
            <TabsTrigger value="competitors" className="text-xs">Competitors</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Format Mix */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Format Mix
                </h3>
                {formatData.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={formatData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {formatData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`${value} ads`, ""]}
                          contentStyle={{
                            background: "oklch(0.14 0.012 264)",
                            border: "1px solid oklch(0.22 0.015 264)",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 flex-1">
                      {formatData.map((d) => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                            <span className="text-sm">{d.name}</span>
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No format data available.</p>
                )}
              </div>

              {/* Platform Split */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Platform Breakdown
                </h3>
                <div className="space-y-4">
                  {[
                    {
                      label: "Meta",
                      data: audit.metaAdsData,
                      color: "bg-blue-500",
                      icon: "📘",
                    },
                    {
                      label: "TikTok",
                      data: audit.tiktokAdsData,
                      color: "bg-pink-500",
                      icon: "🎵",
                    },
                  ].map(({ label, data, color, icon }) => (
                    <div key={label} className="bg-muted/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-medium text-sm flex items-center gap-2">
                          <span>{icon}</span> {label}
                        </span>
                        <span className="text-xs text-muted-foreground">{data?.totalAds ?? 0} ads</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Partnership Ads</p>
                          <p className="font-semibold">
                            {data?.partnershipAds ?? 0} (
                            {data?.totalAds
                              ? ((data.partnershipAds / data.totalAds) * 100).toFixed(1)
                              : 0}
                            %)
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Est. Spend</p>
                          <p className="font-semibold">
                            {fmtCurrency(data?.spendMin ?? 0)} – {fmtCurrency(data?.spendMax ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Impressions</p>
                          <p className="font-semibold">
                            {fmt(data?.impressionsMin ?? 0)} – {fmt(data?.impressionsMax ?? 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Avg Duration</p>
                          <p className="font-semibold">{data?.avgDurationDays ?? 0} days</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Partnership Gap Bar */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-1 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Partnership Gap vs. Competitors
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                % of ads featuring creator partnerships. Target benchmark: 30%+
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={gapData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 264)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "oklch(0.58 0.02 264)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.58 0.02 264)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 60]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "Partnership Ads"]}
                    contentStyle={{
                      background: "oklch(0.14 0.012 264)",
                      border: "1px solid oklch(0.22 0.015 264)",
                      borderRadius: "8px",
                    }}
                  />
                  <ReferenceLine
                    y={30}
                    stroke="oklch(0.78 0.16 75)"
                    strokeDasharray="6 3"
                    label={{ value: "30% Target", fill: "oklch(0.78 0.16 75)", fontSize: 11, position: "right" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {gapData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Andromeda Tab */}
          <TabsContent value="andromeda" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Radar */}
              <div className="glass rounded-2xl p-5">
                <h3 className="font-semibold mb-4">Andromeda Radar</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="oklch(0.22 0.015 264)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "oklch(0.58 0.02 264)", fontSize: 12 }}
                    />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="oklch(0.72 0.18 280)"
                      fill="oklch(0.72 0.18 280)"
                      fillOpacity={0.25}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              {/* Sub-scores */}
              <div className="glass rounded-2xl p-5 space-y-5">
                <h3 className="font-semibold">Sub-Score Breakdown</h3>
                <SubScoreBar
                  label="Format Score"
                  score={formatScore}
                  description="Diversity of ad formats (video, image, carousel, collection)"
                />
                <SubScoreBar
                  label="Partnership Score"
                  score={partnershipScore}
                  description={`${partnershipPct}% of ads feature creator partnerships (target: 30%+)`}
                />
                <SubScoreBar
                  label="Duration Score"
                  score={durationScore}
                  description="Creative freshness — lower scores indicate ad fatigue risk"
                />
              </div>
            </div>

            {/* Insights */}
            <div className="glass rounded-2xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Andromeda Insights
              </h3>
              <div className="space-y-3">
                {[
                  parseFloat(partnershipPct) < 30
                    ? `Only ${partnershipPct}% of ads feature creator partnerships — well below the 30% Andromeda benchmark. This is the single biggest opportunity.`
                    : `Strong creator partnership investment at ${partnershipPct}% — above the 30% benchmark.`,
                  formatScore < 75
                    ? "Creative formats are concentrated. Diversifying into video, carousel, and collection formats will improve algorithm performance."
                    : "Excellent format diversity across all four creative types.",
                  durationScore < 70
                    ? "Average ad flight duration signals creative fatigue risk. Refreshing creatives more frequently is recommended."
                    : "Ad flight duration is within the optimal freshness range.",
                ].map((insight, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-xl">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Creator Gap Tab */}
          <TabsContent value="creators" className="space-y-6">
            {creatorGap ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-amber-400">{creatorGap.gapCount}</p>
                    <p className="text-sm text-muted-foreground mt-1">Untapped Creators</p>
                    <p className="text-xs text-muted-foreground">Organic mentions, no paid deal</p>
                  </div>
                  <div className="glass rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{creatorGap.opportunityScore}</p>
                    <p className="text-sm text-muted-foreground mt-1">Opportunity Score</p>
                    <p className="text-xs text-muted-foreground">Out of 100</p>
                  </div>
                  <div className="glass rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-400">{creatorGap.paidCreators.length}</p>
                    <p className="text-sm text-muted-foreground mt-1">Active Paid Partners</p>
                    <p className="text-xs text-muted-foreground">Currently in paid campaigns</p>
                  </div>
                </div>

                {/* Gap creators */}
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    Untapped Creator Opportunities
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    These creators are already organically mentioning {audit.brandName} but are not in paid partnerships.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {gapCreators.map((creator) => (
                      <CreatorCard key={creator.handle} creator={creator} />
                    ))}
                  </div>
                </div>

                {/* Active partners */}
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Current Paid Partners
                  </h3>
                  <div className="space-y-2">
                    {creatorGap.paidCreators.map((c) => (
                      <div key={c.handle} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{c.handle}</p>
                            <p className="text-xs text-muted-foreground capitalize">{c.platform}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {c.adCount} ad{c.adCount !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass rounded-2xl p-10 text-center">
                <p className="text-muted-foreground">No creator gap data available.</p>
              </div>
            )}
          </TabsContent>

          {/* Competitors Tab */}
          <TabsContent value="competitors" className="space-y-6">
            {competitors.length > 0 ? (
              <>
                {/* Andromeda comparison chart */}
                <div className="glass rounded-2xl p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Andromeda Score Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={[
                        { name: audit.brandName, score: andromedaScore, fill: "oklch(0.72 0.18 280)" },
                        ...competitors.map((c) => ({
                          name: c.brandName,
                          score: c.andromedaScore ?? 0,
                          fill: "oklch(0.68 0.16 200)",
                        })),
                      ]}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.015 264)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "oklch(0.58 0.02 264)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "oklch(0.58 0.02 264)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        formatter={(v: number) => [v, "Andromeda Score"]}
                        contentStyle={{
                          background: "oklch(0.14 0.012 264)",
                          border: "1px solid oklch(0.22 0.015 264)",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                        {[audit, ...competitors].map((_, index) => (
                          <Cell
                            key={index}
                            fill={index === 0 ? "oklch(0.72 0.18 280)" : "oklch(0.68 0.16 200)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Competitor table */}
                <div className="glass rounded-2xl overflow-hidden">
                  <div className="p-5 border-b border-border">
                    <h3 className="font-semibold">Competitor Benchmarks</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-4 text-xs text-muted-foreground font-medium">Brand</th>
                          <th className="text-right p-4 text-xs text-muted-foreground font-medium">Total Ads</th>
                          <th className="text-right p-4 text-xs text-muted-foreground font-medium">Partnership %</th>
                          <th className="text-right p-4 text-xs text-muted-foreground font-medium">Andromeda</th>
                          <th className="text-right p-4 text-xs text-muted-foreground font-medium">Est. Spend</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-border bg-primary/5">
                          <td className="p-4 font-semibold flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            {audit.brandName}
                          </td>
                          <td className="p-4 text-right tabular-nums">{audit.totalAds ?? 0}</td>
                          <td className="p-4 text-right tabular-nums">
                            <span className={parseFloat(partnershipPct) >= 30 ? "text-emerald-400" : "text-red-400"}>
                              {partnershipPct}%
                            </span>
                          </td>
                          <td className="p-4 text-right tabular-nums font-semibold">{andromedaScore}</td>
                          <td className="p-4 text-right text-xs text-muted-foreground">
                            {fmtCurrency(audit.estimatedSpendMin ?? 0)} – {fmtCurrency(audit.estimatedSpendMax ?? 0)}
                          </td>
                        </tr>
                        {competitors.map((c) => {
                          const pct = c.partnershipPct ?? 0;
                          return (
                            <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                              <td className="p-4 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                                {c.brandName}
                              </td>
                              <td className="p-4 text-right tabular-nums">{c.totalAds ?? 0}</td>
                              <td className="p-4 text-right tabular-nums">
                                <span className={pct >= 30 ? "text-emerald-400" : "text-amber-400"}>
                                  {pct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="p-4 text-right tabular-nums font-semibold">{c.andromedaScore ?? 0}</td>
                              <td className="p-4 text-right text-xs text-muted-foreground">
                                {fmtCurrency(c.estimatedSpendMin ?? 0)} – {fmtCurrency(c.estimatedSpendMax ?? 0)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass rounded-2xl p-10 text-center">
                <p className="text-muted-foreground">No competitor data available.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Share footer */}
        <div className="mt-8 glass rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm">Share this audit</p>
            <p className="text-xs text-muted-foreground">
              Anyone with the link can view this report
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-muted px-3 py-1.5 rounded-lg text-muted-foreground max-w-xs truncate">
              {window.location.origin}/share/{audit.shareId}
            </code>
            <Button variant="outline" size="sm" onClick={handleCopyShare} className="gap-1.5 shrink-0">
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/share/${audit.shareId}`, "_blank")}
              className="gap-1.5 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
