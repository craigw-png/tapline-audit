import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ResultCard, type AuditCardData } from "@/components/ResultCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuditPage() {
  useAuth({ redirectOnUnauthenticated: true });

  const params = useParams<{ id: string }>();
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

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.25em] text-primary">
            Humanz
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            New audit
          </Link>
        </div>
      </header>

      <main className="container flex flex-col items-center gap-6 py-12">
        {auditQuery.isLoading && <p className="text-muted-foreground">Loading audit{"\u2026"}</p>}
        {!auditQuery.isLoading && !audit && (
          <p className="text-muted-foreground">Audit not found.</p>
        )}

        {card && <ResultCard data={card} />}

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
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Open the Ad Library {"\u2192"}
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
