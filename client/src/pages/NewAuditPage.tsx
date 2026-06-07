import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Plus, X, Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function NewAuditPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const brandName = params.get("brand") ?? "";
  const brandSlug = params.get("slug") ?? "";

  const [competitors, setCompetitors] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [period] = useState("2026-05");
  const [brandDomain, setBrandDomain] = useState("");

  const { data: suggestions } = trpc.competitor.suggest.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const createAudit = trpc.audit.create.useMutation({
    onSuccess: (data) => {
      if (data?.audit?.id) {
        navigate(`/audit/${data.audit.id}`);
      }
    },
    onError: () => {
      toast.error("Failed to create audit. Please try again.");
    },
  });

  // Pre-select suggested competitors
  useEffect(() => {
    if (suggestions && competitors.length === 0) {
      setCompetitors(suggestions.map((s) => s.name));
    }
  }, [suggestions]);

  const toggleCompetitor = (name: string) => {
    setCompetitors((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : prev.length < 5 ? [...prev, name] : prev
    );
  };

  const addCustom = () => {
    const trimmed = customInput.trim();
    if (!trimmed || competitors.includes(trimmed) || competitors.length >= 5) return;
    setCompetitors((prev) => [...prev, trimmed]);
    setCustomInput("");
  };

  const handleStart = () => {
    if (!brandName || !brandSlug) {
      toast.error("Brand information is missing.");
      return;
    }
    createAudit.mutate({
      brandName,
      brandSlug,
      period,
      competitors,
      brandDomain: brandDomain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background grid-bg">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center gap-3 h-14">
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
      </header>

      <main className="container py-12 max-w-2xl mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">Brand Selected</span>
          </div>
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <span className="text-sm font-medium text-primary">Add Competitors</span>
          </div>
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground">3</span>
            </div>
            <span className="text-sm text-muted-foreground">Run Audit</span>
          </div>
        </div>

        {/* Brand info */}
        <div className="glass rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Auditing</p>
              <h2 className="text-xl font-bold">{brandName}</h2>
              <p className="text-xs text-muted-foreground mt-1">Period: {period}</p>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              Combined (Meta + TikTok)
            </Badge>
          </div>
        </div>

        {/* Competitor selection */}
        <div className="glass rounded-2xl p-5 mb-6">
          <h3 className="font-semibold mb-1">Select Competitors</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose up to 5 competitors to benchmark against. We've suggested some based on your brand's category.
          </p>

          {/* Suggested */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(suggestions ?? []).map((s) => {
              const selected = competitors.includes(s.name);
              return (
                <button
                  key={s.slug}
                  onClick={() => toggleCompetitor(s.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                    selected
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {selected && <Check className="w-3 h-3" />}
                  {s.name}
                </button>
              );
            })}
          </div>

          {/* Selected chips */}
          {competitors.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Selected ({competitors.length}/5)</p>
              <div className="flex flex-wrap gap-2">
                {competitors.map((c) => (
                  <div
                    key={c}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-sm text-primary"
                  >
                    {c}
                    <button onClick={() => toggleCompetitor(c)} className="hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom input */}
          <div className="flex gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
              placeholder="Add a custom competitor..."
              className="h-9 text-sm bg-input/50"
              disabled={competitors.length >= 5}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addCustom}
              disabled={!customInput.trim() || competitors.length >= 5}
              className="shrink-0"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          {competitors.length >= 5 && (
            <p className="text-xs text-amber-400 mt-2">Maximum 5 competitors reached.</p>
          )}
        </div>

        {/* Optional domain for Halo Effect */}
        <div className="glass rounded-2xl p-5 mb-6">
          <h3 className="font-semibold mb-1">Website Domain <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span></h3>
          <p className="text-sm text-muted-foreground mb-3">
            Add the brand&apos;s website domain to unlock the <strong>Halo Effect</strong> tab — traffic intelligence showing whether creator and ad activity is actually landing on the brand&apos;s own site.
          </p>
          <Input
            value={brandDomain}
            onChange={(e) => setBrandDomain(e.target.value)}
            placeholder="e.g. ninjahousehold.com"
            className="h-9 text-sm bg-input/50"
          />
          <p className="text-xs text-muted-foreground mt-2">
            You can also add this later from within the audit. Each traffic pull uses Manus Data API credits.
          </p>
        </div>

        {/* CTA */}
        <Button
          onClick={handleStart}
          disabled={createAudit.isPending}
          className="w-full h-12 text-base btn-glow"
        >
          {createAudit.isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Running Audit...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Run Audit
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Live Meta Ads Library data when token is configured · TikTok integration coming soon
        </p>
      </main>
    </div>
  );
}
