import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { PARTNERSHIP_BENCHMARK_PCT } from "@shared/const";
import { ResultCard, type AuditCardData } from "@/components/ResultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, AlertTriangle } from "lucide-react";

type Outputs = inferRouterOutputs<AppRouter>;
type CreateResult = Outputs["audit"]["create"];
type Candidate = Outputs["brand"]["resolveCandidates"]["candidates"][number];

type Phase = "input" | "candidates" | "result";

const ALL_COUNTRIES = [
  { code: "NL", label: "Netherlands" },
  { code: "BE", label: "Belgium" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "GB", label: "United Kingdom" },
  { code: "SE", label: "Sweden" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "FI", label: "Finland" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "PT", label: "Portugal" },
  { code: "PL", label: "Poland" },
  { code: "AT", label: "Austria" },
  { code: "CH", label: "Switzerland" },
  { code: "IE", label: "Ireland" },
  { code: "CZ", label: "Czech Republic" },
  { code: "HU", label: "Hungary" },
  { code: "RO", label: "Romania" },
  { code: "GR", label: "Greece" },
  { code: "HR", label: "Croatia" },
  { code: "SK", label: "Slovakia" },
  { code: "SI", label: "Slovenia" },
  { code: "BG", label: "Bulgaria" },
  { code: "LT", label: "Lithuania" },
  { code: "LV", label: "Latvia" },
  { code: "EE", label: "Estonia" },
  { code: "LU", label: "Luxembourg" },
  { code: "MT", label: "Malta" },
  { code: "CY", label: "Cyprus" },
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "NZ", label: "New Zealand" },
  { code: "ZA", label: "South Africa" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "TR", label: "Turkey" },
  { code: "IL", label: "Israel" },
  { code: "JP", label: "Japan" },
  { code: "SG", label: "Singapore" },
  { code: "IN", label: "India" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
];

/** Quick-search suggestions for demo / common brands */
const QUICK_SEARCHES = [
  { label: "Ninja Kitchen", country: "GB" },
  { label: "HEMA", country: "NL" },
  { label: "Dreame", country: "NL" },
  { label: "Emma Sleep", country: "NL" },
];

function buildCandidateLibraryUrl(pageId: string, countryCode: string): string {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country: countryCode,
    view_all_page_id: pageId,
    search_type: "page",
    media_type: "all",
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

function toCardData(r: CreateResult, fallbackBrand: string, sourceLabel: string): AuditCardData | null {
  if (!r.result) return null;
  return {
    brandName: r.result.brandName || fallbackBrand,
    totalAds: r.result.totalAds,
    partnershipAds: r.result.partnershipAds,
    partnershipPct: r.result.partnershipPct,
    partnershipConfirmed: r.result.isConfirmed,
    sourceLabel,
  };
}

/** Token expiry warning banner — shown when token is within 14 days of expiry */
function TokenExpiryBanner() {
  const tokenStatus = trpc.meta.tokenStatus.useQuery(undefined, {
    staleTime: 1000 * 60 * 60, // re-check once per hour
    retry: false,
  });

  const { daysLeft } = tokenStatus.data ?? {};
  if (daysLeft == null || daysLeft > 14) return null;

  const isExpired = daysLeft <= 0;
  return (
    <Alert className="mb-6 border-amber-500/40 bg-amber-500/10 text-amber-300">
      <AlertTriangle className="h-4 w-4 text-amber-400" />
      <AlertDescription className="text-amber-300">
        {isExpired
          ? "Meta access token has expired — live audits will fail. Please refresh the token."
          : `Meta access token expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Refresh it soon to avoid disruption.`}
      </AlertDescription>
    </Alert>
  );
}

export default function Home() {
  useAuth({ redirectOnUnauthenticated: true });

  const search = useSearch();

  const utils = trpc.useUtils();
  const createAudit = trpc.audit.create.useMutation();
  const confirmCount = trpc.audit.confirmPartnershipCount.useMutation();

  const [phase, setPhase] = useState<Phase>("input");
  const [brandName, setBrandName] = useState("");

  // Pre-fill brand name from ?brand= query param (used by Re-run Audit button)
  useEffect(() => {
    const params = new URLSearchParams(search);
    const prefilledBrand = params.get("brand");
    if (prefilledBrand) setBrandName(prefilledBrand);
  }, [search]);
  const [country, setCountry] = useState("NL");
  const [days, setDays] = useState("30");
  const [resolving, setResolving] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const [card, setCard] = useState<AuditCardData | null>(null);
  const [auditId, setAuditId] = useState<number | null>(null);
  const [reviewAds, setReviewAds] = useState<CreateResult["candidateAds"]>([]);
  const [libraryUrl, setLibraryUrl] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("0");
  const [manualTotal, setManualTotal] = useState("");
  const [manualPartner, setManualPartner] = useState("");

  const sourceLabel = `Meta \u00b7 ${country} \u00b7 last ${days} days`;

  function reset() {
    setPhase("input");
    setCandidates([]);
    setNotice(null);
    setCard(null);
    setAuditId(null);
    setReviewAds([]);
    setLibraryUrl(null);
    setConfirmInput("0");
    setManualTotal("");
    setManualPartner("");
  }

  async function findBrand(overrideName?: string, overrideCountry?: string) {
    const name = overrideName ?? brandName;
    const cc = overrideCountry ?? country;
    if (!name.trim()) return;
    if (overrideName) setBrandName(overrideName);
    if (overrideCountry) setCountry(overrideCountry);
    setResolving(true);
    setNotice(null);
    try {
      const res = await utils.brand.resolveCandidates.fetch({ brandName: name.trim(), countryCode: cc });
      setCandidates(res.candidates);
      if (!res.candidates.length) {
        setNotice(
          res.hasLiveSearch
            ? "No Meta Page found for that name. Check the spelling or enter the counts manually below."
            : "Live search isn't configured (no Meta token). Enter the counts manually below."
        );
      }
      setPhase("candidates");
    } finally {
      setResolving(false);
    }
  }

  function applyResult(r: CreateResult) {
    setAuditId(r.audit?.id ?? null);
    setReviewAds(r.candidateAds ?? []);
    setLibraryUrl(r.audit?.adLibraryUrl ?? null);
    const data = toCardData(r, brandName.trim(), sourceLabel);
    setCard(data);
    if (data) setConfirmInput(String(data.partnershipAds));
    if (!data && "message" in r && r.message) setNotice(r.message);
    setPhase("result");
  }

  async function runLive(metaPageId: string) {
    try {
      const r = await createAudit.mutateAsync({
        brandName: brandName.trim(),
        metaPageId,
        countryCode: country,
        days: Number(days),
      });
      applyResult(r);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Audit failed — please try again.");
    }
  }

  async function runManual() {
    const total = Number(manualTotal);
    const partner = Number(manualPartner);
    if (!Number.isFinite(total) || total < 0) return;
    try {
      const r = await createAudit.mutateAsync({
        brandName: brandName.trim(),
        countryCode: country,
        days: Number(days),
        manual: { totalAds: total, partnershipAds: Number.isFinite(partner) ? partner : 0 },
      });
      applyResult(r);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Audit failed — please try again.");
    }
  }

  async function confirm() {
    if (auditId == null) return;
    const cr = await confirmCount.mutateAsync({
      auditId,
      confirmedPartnershipAds: Number(confirmInput) || 0,
    });
    if (cr.result) {
      setCard({
        brandName: cr.result.brandName,
        totalAds: cr.result.totalAds,
        partnershipAds: cr.result.partnershipAds,
        partnershipPct: cr.result.partnershipPct,
        partnershipConfirmed: true,
        sourceLabel,
      });
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-[0.25em] text-primary">Humanz</span>
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Partnership Audit
          </span>
        </div>
      </header>

      <main className="container py-12">
        {/* Token expiry warning — shown at top of page when close to expiry */}
        <div className="mx-auto max-w-xl">
          <TokenExpiryBanner />
        </div>

        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold sm:text-4xl">
            How many of a brand&apos;s ads are{" "}
            <span className="text-primary">creator partnerships?</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            The benchmark is {PARTNERSHIP_BENCHMARK_PCT}%. Pull any brand&apos;s active Meta ads and
            see where they land.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-xl">
          {phase === "input" && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <Label htmlFor="brand">Brand name</Label>
              <Input
                id="brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. Albert Heijn"
                className="mt-2"
                onKeyDown={(e) => e.key === "Enter" && findBrand()}
              />

              {/* Quick-search suggestions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {QUICK_SEARCHES.map((s) => (
                  <button
                    key={`${s.label}-${s.country}`}
                    onClick={() => findBrand(s.label, s.country)}
                    disabled={resolving}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
                  >
                    {s.label} <span className="opacity-60">{s.country}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <Label>Market</Label>
                  <Select value={country} onValueChange={setCountry}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {ALL_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Window</Label>
                  <Select value={days} onValueChange={setDays}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="60">Last 60 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-6 w-full" onClick={() => findBrand()} disabled={resolving || !brandName.trim()}>
                {resolving ? "Searching\u2026" : "Find brand"}
              </Button>
            </div>
          )}

          {phase === "candidates" && (
            <div className="rounded-2xl border border-border bg-card p-6">
              <button onClick={reset} className="text-sm text-muted-foreground hover:text-foreground">{"\u2190 Start over"}</button>

              {candidates.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium">Which Meta Page is this brand?</h3>
                  <div className="mt-3 space-y-2">
                    {candidates.map((c) => (
                      <div key={c.id} className="flex items-stretch gap-2">
                        {/* Main clickable card — runs the audit */}
                        <button
                          onClick={() => runLive(c.id)}
                          disabled={createAudit.isPending}
                          className="flex flex-1 items-center justify-between rounded-lg border border-border px-4 py-3 text-left transition hover:border-primary disabled:opacity-50"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{c.name}</span>
                            {c.domain && (
                              <span className="text-xs text-muted-foreground">{c.domain}</span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0 ml-4">
                            {c.ad_count != null && (
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                c.ad_count >= 10 ? 'bg-green-500/15 text-green-400' :
                                c.ad_count >= 1  ? 'bg-amber-500/15 text-amber-400' :
                                                   'bg-muted text-muted-foreground'
                              }`}>
                                {c.ad_count} ads / 90d
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">ID {c.id}</span>
                          </div>
                        </button>

                        {/* External link to Meta Ads Library — verify before confirming */}
                        <a
                          href={buildCandidateLibraryUrl(c.id, country)}
                          target="_blank"
                          rel="noreferrer"
                          title="View in Meta Ads Library"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center rounded-lg border border-border px-3 text-muted-foreground transition hover:border-primary hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notice && <p className="mt-4 text-sm text-muted-foreground">{notice}</p>}

              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-medium">Or enter counts manually</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Read these off the Meta Ad Library, then confirm here.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mt">Total active ads</Label>
                    <Input id="mt" inputMode="numeric" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="mp">Partnership ads</Label>
                    <Input id="mp" inputMode="numeric" value={manualPartner} onChange={(e) => setManualPartner(e.target.value)} className="mt-2" />
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="mt-4 w-full"
                  onClick={runManual}
                  disabled={createAudit.isPending || !manualTotal}
                >
                  {createAudit.isPending ? "Running\u2026" : "Run manual audit"}
                </Button>
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="flex flex-col items-center gap-6">
              {card ? (
                <ResultCard data={card} />
              ) : (
                <div className="w-full rounded-2xl border border-border bg-card p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {notice ?? "Couldn't pull live data for this brand."}
                  </p>
                  {libraryUrl && (
                    <a href={libraryUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">
                      Open the Ad Library {"\u2192"}
                    </a>
                  )}
                </div>
              )}

              {card && !card.partnershipConfirmed && (
                <div className="w-full max-w-[600px] rounded-2xl border border-border bg-card p-6">
                  <h3 className="text-sm font-medium">Confirm the partnership count</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Open each, check for the Paid Partnership label, then set the confirmed number.
                  </p>

                  {reviewAds.length > 0 && (
                    <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">
                      {reviewAds.map((a) => (
                        <a
                          key={a.id}
                          href={a.snapshotUrl ?? `https://www.facebook.com/ads/library/?id=${a.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 truncate rounded border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          <span className="truncate">{a.excerpt || `Ad ${a.id}`}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {libraryUrl && (
                    <a href={libraryUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="h-3 w-3" />
                      Open full Ad Library
                    </a>
                  )}

                  <div className="mt-4 flex items-end gap-3">
                    <div className="flex-1">
                      <Label htmlFor="confirm">Confirmed partnership ads</Label>
                      <Input
                        id="confirm"
                        inputMode="numeric"
                        value={confirmInput}
                        onChange={(e) => setConfirmInput(e.target.value)}
                        className="mt-2"
                      />
                    </div>
                    <Button onClick={confirm} disabled={confirmCount.isPending}>
                      {confirmCount.isPending ? "Saving\u2026" : "Confirm"}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={reset}>
                  Run another
                </Button>
                {auditId != null && (
                  <Link href={`/audit/${auditId}`} className="text-sm text-muted-foreground hover:text-foreground">
                    Open saved audit {"\u2192"}
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
