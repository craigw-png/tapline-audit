import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ResultCard, type AuditCardData } from "@/components/ResultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, RefreshCw } from "lucide-react";

export default function AuditPage() {
  useAuth({ redirectOnUnauthenticated: true });

  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = Number(params.id);

  const utils = trpc.useUtils();
  const auditQuery = trpc.audit.get.useQuery({ id }, { enabled: Number.isFinite(id) });
  const confirmCount = trpc.audit.confirmPartnershipCount.useMutation({
    onSuccess: () => utils.audit.get.invalidate({ id }),
  });

  const audit = auditQuery.data ?? null;
  const [confirmInput, setConfirmInput] = useState("0");

  useEffect(() => {
    if (audit) setConfirmInput(String(audit.partnershipAds ?? 0));
  }, [audit]);

  const card: AuditCardData | null = audit
    ? {
        brandName: audit.brandName,
        totalAds: audit.totalAds ?? 0,
        partnershipAds: audit.partnershipAds ?? 0,
        partnershipPct: audit.partnershipPct ?? 0,
        partnershipConfirmed: audit.partnershipConfirmed ?? false,
        sourceLabel: `Meta \u00b7 ${audit.period}`,
      }
    : null;

  // Parse candidateAds from the stored JSON
  const candidateAds = (() => {
    try {
      const raw = (audit as { candidateAds?: unknown })?.candidateAds;
      if (Array.isArray(raw)) return raw as Array<{ id: string; snapshotUrl?: string; excerpt: string }>;
      if (typeof raw === "string") return JSON.parse(raw) as Array<{ id: string; snapshotUrl?: string; excerpt: string }>;
    } catch { /* ignore */ }
    return [];
  })();

  /**
   * Re-run: navigate back to the home page with the brand name pre-filled via
   * query string so the user can pick the same page and run a fresh audit.
   * We don't store countryCode or days on the audit record, so the user selects
   * them again — this is intentional (they may want a different window).
   */
  function handleRerun() {
    if (!audit) return;
    navigate(`/?brand=${encodeURIComponent(audit.brandName)}`);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.25em] text-primary">
            Humanz
          </Link>
          <div className="flex items-center gap-4">
            {audit && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRerun}
                className="flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-run Audit
              </Button>
            )}
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              New audit
            </Link>
          </div>
        </div>
      </header>

      <main className="container flex flex-col items-center gap-6 py-12">
        {auditQuery.isLoading && <p className="text-muted-foreground">Loading audit{"\u2026"}</p>}
        {!auditQuery.isLoading && !audit && (
          <p className="text-muted-foreground">Audit not found.</p>
        )}

        {card && <ResultCard data={card} />}

        {/* Partnership ads review list */}
        {card && candidateAds.length > 0 && (
          <div className="w-full max-w-[600px] rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                Detected partnership ads ({candidateAds.length})
              </h3>
              {audit?.adLibraryUrl && (
                <a
                  href={audit.adLibraryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open Ad Library
                </a>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Click each to verify the Paid Partnership label in the Ad Library.
            </p>
            <div className="mt-3 max-h-52 space-y-1 overflow-y-auto">
              {candidateAds.map((a) => (
                <a
                  key={a.id}
                  href={a.snapshotUrl ?? `https://www.facebook.com/ads/library/?id=${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-foreground"
                >
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  <span className="truncate">{a.excerpt || `Ad ${a.id}`}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {card && !card.partnershipConfirmed && (
          <div className="w-full max-w-[600px] rounded-2xl border border-border bg-card p-6">
            <h3 className="text-sm font-medium">Confirm the partnership count</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Check the visible Paid Partnership labels in the Ad Library, then set the confirmed
              number.
            </p>
            {audit?.adLibraryUrl && (
              <a
                href={audit.adLibraryUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open the Ad Library
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
              <Button
                onClick={() =>
                  confirmCount.mutate({ auditId: id, confirmedPartnershipAds: Number(confirmInput) || 0 })
                }
                disabled={confirmCount.isPending}
              >
                {confirmCount.isPending ? "Saving\u2026" : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
