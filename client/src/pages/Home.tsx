import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Search, ArrowRight, Clock, TrendingUp, Zap, BarChart3, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { Audit } from "@/types/audit";

function AndromedaRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 70 ? "oklch(0.75 0.16 155)" : score >= 50 ? "oklch(0.78 0.16 75)" : "oklch(0.62 0.22 25)";

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="oklch(0.22 0.015 264)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="score-ring"
      />
    </svg>
  );
}

function RecentAuditCard({ audit }: { audit: Audit }) {
  const [, navigate] = useLocation();
  const score = audit.andromedaScore ?? 0;
  const grade =
    score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : score >= 35 ? "D" : "F";
  const gradeColor =
    grade === "A"
      ? "text-emerald-400"
      : grade === "B"
        ? "text-blue-400"
        : grade === "C"
          ? "text-amber-400"
          : "text-red-400";

  return (
    <button
      onClick={() => navigate(`/audit/${audit.id}`)}
      className="group w-full text-left glass rounded-xl p-4 hover:border-[oklch(0.72_0.18_280/0.5)] transition-all duration-200 hover:shadow-[0_0_20px_oklch(0.72_0.18_280/0.1)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-foreground truncate">{audit.brandName}</span>
            {audit.usedMockData && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                Demo
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(audit.createdAt), { addSuffix: true })}
            </span>
            <span>{audit.period}</span>
            <span>{audit.totalAds ?? 0} ads</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <AndromedaRing score={score} size={40} />
            <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold rotate-90 ${gradeColor}`}>
              {grade}
            </span>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: recentAudits, isLoading: loadingRecent } = trpc.audit.listRecent.useQuery();
  const { data: searchData } = trpc.brand.search.useQuery(
    { query },
    { enabled: query.length >= 2 }
  );

  const resolveMutation = trpc.brand.resolve.useMutation();

  const handleSearch = async (brandName: string) => {
    setShowSuggestions(false);
    setQuery(brandName);
    const result = await resolveMutation.mutateAsync({ query: brandName });
    if (result?.brand) {
      navigate(`/audit/new?brand=${encodeURIComponent(brandName)}&slug=${result.brand.slug}`);
    } else {
      navigate(`/audit/new?brand=${encodeURIComponent(brandName)}&slug=${brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim().length >= 2) {
      handleSearch(query.trim());
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.closest(".search-container")?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const suggestions = searchData?.suggestions ?? [];

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight">Tapline</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
              Audit
            </Badge>
          </div>
          <nav className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
              Documentation
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground text-xs">
              API Status
            </Button>
          </nav>
        </div>
      </header>

      <main className="container py-16 md:py-24">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[oklch(0.72_0.18_280/0.3)] bg-[oklch(0.72_0.18_280/0.08)] text-xs text-primary mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Powered by the Andromeda Algorithm
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-5">
            Reveal the{" "}
            <span className="gradient-text">creator gap</span>
            <br />
            in any brand's ad strategy
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Tapline analyses Meta and TikTok ad libraries to score creative diversity, identify
            partnership opportunities, and benchmark against competitors — in seconds.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-2xl mx-auto mb-16">
          <div className="search-container relative">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowSuggestions(e.target.value.length >= 2);
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                placeholder="Search any brand — e.g. Ninja Kitchen, KitchenAid..."
                className="pl-12 pr-32 h-14 text-base bg-card border-border/70 rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50"
              />
              <Button
                onClick={() => query.trim().length >= 2 && handleSearch(query.trim())}
                disabled={query.trim().length < 2 || resolveMutation.isPending}
                className="absolute right-2 h-10 px-5 rounded-lg btn-glow transition-all"
              >
                {resolveMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Resolving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Audit Brand
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 glass rounded-xl border border-border overflow-hidden z-50 shadow-2xl">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(s.name)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      {s.industry && (
                        <div className="text-xs text-muted-foreground">{s.industry}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Try: <button onClick={() => handleSearch("Ninja Kitchen")} className="text-primary hover:underline">Ninja Kitchen UK</button>
            {" · "}
            <button onClick={() => handleSearch("KitchenAid")} className="text-primary hover:underline">KitchenAid UK</button>
            {" · "}
            <button onClick={() => handleSearch("Sage Appliances")} className="text-primary hover:underline">Sage Appliances</button>
          </p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-20">
          {[
            { icon: BarChart3, label: "Meta Ads Analysis" },
            { icon: TrendingUp, label: "TikTok Ad Data" },
            { icon: Zap, label: "Andromeda Score" },
            { icon: Users, label: "Creator Gap Analysis" },
            { icon: FileText, label: "PDF Pitch Reports" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 bg-card/50 text-xs text-muted-foreground"
            >
              <Icon className="w-3.5 h-3.5 text-primary" />
              {label}
            </div>
          ))}
        </div>

        {/* Recent Audits */}
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">Recent Audits</h2>
            <span className="text-xs text-muted-foreground">
              {recentAudits?.length ?? 0} completed
            </span>
          </div>

          {loadingRecent ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : recentAudits && recentAudits.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentAudits.map((audit) => (
                <RecentAuditCard key={audit.id} audit={audit as Audit} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 glass rounded-2xl">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                No audits yet. Search for a brand above to get started.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-20">
        <div className="container py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>© 2026 Tapline. All rights reserved.</span>
          <span>Powered by the Andromeda Algorithm</span>
        </div>
      </footer>
    </div>
  );
}
