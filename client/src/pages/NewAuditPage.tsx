import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Plus, X, Zap, Check, Clock, ShieldCheck, AlertCircle, Search, ExternalLink, Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const PERIOD_PRESETS = [
  { value: "last-30", label: "Last 30 days", description: "~1 month of ad activity" },
  { value: "last-90", label: "Last 90 days", description: "~3 months — recommended" },
  { value: "last-180", label: "Last 6 months", description: "Mid-term trend view" },
  { value: "last-365", label: "Last 12 months", description: "Full year overview" },
];

function resolvePresetToPeriod(preset: string): string {
  const now = new Date();
  const offsets: Record<string, number> = {
    "last-30": 30,
    "last-90": 90,
    "last-180": 180,
    "last-365": 365,
  };
  const days = offsets[preset];
  if (days) {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return preset;
}

function formatFanCount(n?: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M followers`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K followers`;
  return `${n} followers`;
}

export default function NewAuditPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const brandName = params.get("brand") ?? "";
  const brandSlug = params.get("slug") ?? "";

  const [competitors, setCompetitors] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState("");
  const [periodPreset, setPeriodPreset] = useState("last-90");
  const [brandDomain, setBrandDomain] = useState("");

  const utils = trpc.useUtils();

  // Brand account confirmation state
  const [confirmedMetaPageId, setConfirmedMetaPageId] = useState<string | null>(null);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [manualPageId, setManualPageId] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const { data: candidatesData, isLoading: candidatesLoading } = trpc.brand.resolveCandidates.useQuery(
    { brandName },
    { enabled: !!brandName }
  );

  const confirmMetaPage = trpc.brand.confirmMetaPage.useMutation();

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

  // Auto-select preferred candidate when data loads
  useEffect(() => {
    if (candidatesData && !confirmedMetaPageId) {
      if (candidatesData.preferredId) {
        setConfirmedMetaPageId(candidatesData.preferredId);
      } else if (candidatesData.candidates.length > 0) {
        setConfirmedMetaPageId(candidatesData.candidates[0].id);
      }
    }
  }, [candidatesData]);

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

  const handleSelectCandidate = (id: string) => {
    setConfirmedMetaPageId(id);
    setShowManualInput(false);
  };

  const [resolvingUrl, setResolvingUrl] = useState(false);

  // Extract page slug from a Facebook URL, e.g. https://www.facebook.com/Emma.Sleep.nl → Emma.Sleep.nl
  function extractFbSlug(input: string): string | null {
    try {
      const url = new URL(input);
      if (url.hostname.includes("facebook.com")) {
        const slug = url.pathname.replace(/^\//, "").split("/")[0];
        return slug || null;
      }
    } catch {
      // Not a URL
    }
    return null;
  }

  const handleManualConfirm = async () => {
    const raw = manualPageId.trim();
    if (!raw) return;

    // If it's already a numeric ID, use directly
    if (/^\d+$/.test(raw)) {
      setConfirmedMetaPageId(raw);
      setShowManualInput(false);
      setManualPageId("");
      toast.success("Meta Page ID confirmed");
      return;
    }

    // If it's a Facebook URL, extract the slug and search for it
    const slug = extractFbSlug(raw) ?? raw;
    setResolvingUrl(true);
    try {
      // Search the Ads Archive using the slug as search term
      const result = await utils.brand.resolveCandidates.fetch({ brandName: slug });
      if (result.candidates.length > 0) {
        // Pick the best match
        const best = result.candidates[0];
        setConfirmedMetaPageId(best.id);
        setShowManualInput(false);
        setManualPageId("");
        toast.success(`Found: ${best.name} (ID: ${best.id})`);
      } else {
        toast.error(`Could not find a Meta page for "${slug}". Try pasting the numeric Page ID instead.`);
      }
    } catch {
      toast.error("Failed to resolve the URL. Please try a numeric Page ID.");
    } finally {
      setResolvingUrl(false);
    }
  };

  const handleStart = async () => {
    if (!brandName || !brandSlug) {
      toast.error("Brand information is missing.");
      return;
    }

    // If user confirmed a specific page ID, persist it before running audit
    if (confirmedMetaPageId) {
      await confirmMetaPage.mutateAsync({ brandSlug, metaPageId: confirmedMetaPageId });
    }

    createAudit.mutate({
      brandName,
      brandSlug,
      period: resolvePresetToPeriod(periodPreset),
      competitors,
      brandDomain: brandDomain.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || undefined,
    });
  };

  const selectedPreset = PERIOD_PRESETS.find((p) => p.value === periodPreset);
  const visibleCandidates = showAllCandidates
    ? (candidatesData?.candidates ?? [])
    : (candidatesData?.candidates ?? []).slice(0, 3);

  const confirmedCandidate = candidatesData?.candidates.find((c) => c.id === confirmedMetaPageId);
  const isConfirmed = !!confirmedMetaPageId;

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
            <span className="text-sm font-medium text-primary">Configure Audit</span>
          </div>
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground">3</span>
            </div>
            <span className="text-sm text-muted-foreground">Run Audit</span>
          </div>
        </div>

        {/* ── Meta Account Confirmation ─────────────────────────────────────── */}
        <div className="glass rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Confirm Meta Ads Account</h3>
            {isConfirmed && (
              <Badge className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                <Check className="w-3 h-3 mr-1" /> Confirmed
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            We pull ads from a specific Facebook Page. Confirm this is the right account before running the audit — wrong account = wrong data.
          </p>

          {candidatesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Searching Meta Ads Library for "{brandName}"...
            </div>
          ) : candidatesData?.candidates.length === 0 ? (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
              <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-300">No Meta pages found automatically</p>
                <p className="text-muted-foreground mt-0.5">
                  Enter the Facebook Page ID manually below. You can find it in the Meta Ads Library or on the brand's Facebook page URL.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {visibleCandidates.map((c) => {
                const isSelected = confirmedMetaPageId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCandidate(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary/50"
                        : "bg-muted/30 border-border hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    {/* Selection indicator */}
                    <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                    </div>

                    {/* Page info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {c.name}
                        </span>
                        {c.verification_status?.includes("verified") && (
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" aria-label="Verified page" />
                        )}
                        {c.isPreferred && (
                          <Badge className="bg-primary/15 text-primary border-primary/20 text-xs px-1.5 py-0">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {c.category && (
                          <span className="text-xs text-muted-foreground">{c.category}</span>
                        )}
                        {c.fan_count && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            {formatFanCount(c.fan_count)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground font-mono">ID: {c.id}</span>
                      </div>
                    </div>

                    {/* Meta Ads Library link */}
                    <a
                      href={`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=NL&view_all_page_id=${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      title="View in Meta Ads Library"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </button>
                );
              })}

              {/* Show more / less */}
              {(candidatesData?.candidates.length ?? 0) > 3 && (
                <button
                  onClick={() => setShowAllCandidates(!showAllCandidates)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                  {showAllCandidates ? (
                    <><ChevronUp className="w-3 h-3" /> Show fewer</>
                  ) : (
                    <><ChevronDown className="w-3 h-3" /> Show {(candidatesData?.candidates.length ?? 0) - 3} more results</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Manual Page ID entry */}
          {!showManualInput ? (
            <button
              onClick={() => setShowManualInput(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Search className="w-3 h-3" />
              Enter Page ID manually
            </button>
          ) : (
            <div className="space-y-1.5 mt-2">
              <Input
                value={manualPageId}
                onChange={(e) => setManualPageId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualConfirm()}
                placeholder="Paste Facebook URL or numeric Page ID"
                className="h-9 text-sm bg-input/50"
                autoFocus
                disabled={resolvingUrl}
              />
              <p className="text-xs text-muted-foreground">
                Accepts: <span className="font-mono">https://www.facebook.com/Emma.Sleep.nl</span> or a numeric ID like <span className="font-mono">249220112144810</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleManualConfirm} disabled={!manualPageId.trim() || resolvingUrl} className="shrink-0">
                  {resolvingUrl ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Resolving...
                    </span>
                  ) : "Use this"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setShowManualInput(false); setManualPageId(""); }} className="shrink-0" disabled={resolvingUrl}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Confirmed summary */}
          {confirmedMetaPageId && !showManualInput && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                Pulling ads from{" "}
                <span className="text-foreground font-medium">
                  {confirmedCandidate?.name ?? "custom page"}
                </span>{" "}
                <span className="font-mono text-muted-foreground">(ID: {confirmedMetaPageId})</span>
              </span>
              <a
                href={`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=NL&view_all_page_id=${confirmedMetaPageId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-primary hover:underline flex items-center gap-1"
              >
                Verify in Ads Library <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Brand info + Time period */}
        <div className="glass rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Auditing</p>
              <h2 className="text-xl font-bold">{brandName}</h2>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20">
              Meta Ads + TikTok
            </Badge>
          </div>

          {/* Time period selector */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time Period</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mb-2">
              {PERIOD_PRESETS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPeriodPreset(opt.value)}
                  className={`px-3 py-2.5 rounded-xl text-sm border transition-all text-left ${
                    periodPreset === opt.value
                      ? "bg-primary/15 border-primary/50 text-primary"
                      : "bg-muted/30 border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  <div className={`font-medium text-xs ${periodPreset === opt.value ? "text-primary" : "text-foreground"}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-tight">{opt.description}</div>
                </button>
              ))}
            </div>
            {selectedPreset && (
              <p className="text-xs text-muted-foreground">
                Analysing ad activity from the <span className="text-foreground font-medium">{selectedPreset.label.toLowerCase()}</span>
              </p>
            )}
          </div>
        </div>

        {/* Competitor selection */}
        <div className="glass rounded-2xl p-5 mb-6">
          <h3 className="font-semibold mb-1">Select Competitors</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose up to 5 competitors to benchmark against. We've suggested some based on your brand's category.
          </p>

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
            placeholder="e.g. dreame.com/nl"
            className="h-9 text-sm bg-input/50"
          />
          <p className="text-xs text-muted-foreground mt-2">
            You can also add this later from within the audit. Each traffic pull uses Manus Data API credits.
          </p>
        </div>

        {/* CTA */}
        <Button
          onClick={handleStart}
          disabled={createAudit.isPending || confirmMetaPage.isPending || !isConfirmed}
          className="w-full h-12 text-base btn-glow"
        >
          {createAudit.isPending || confirmMetaPage.isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Running Audit...
            </span>
          ) : !isConfirmed ? (
            <span className="flex items-center gap-2 opacity-60">
              <ShieldCheck className="w-4 h-4" />
              Confirm Meta Account First
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Run Audit — {selectedPreset?.label}
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
        {isConfirmed && (
          <p className="text-center text-xs text-muted-foreground mt-3">
            Pulling live Meta Ads from{" "}
            <span className="text-foreground">{confirmedCandidate?.name ?? "confirmed page"}</span>
            {" · "}TikTok Research API connected
          </p>
        )}
      </main>
    </div>
  );
}
