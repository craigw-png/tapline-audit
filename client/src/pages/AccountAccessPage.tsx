import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Shield,
  Eye,
  CheckCircle2,
  ChevronRight,
  Lock,
  BarChart3,
  TrendingUp,
  Zap,
  ArrowLeft,
  ExternalLink,
  Clock,
  AlertCircle,
} from "lucide-react";

// ─── What you unlock section ──────────────────────────────────────────────────

const UNLOCKED_METRICS = [
  {
    icon: TrendingUp,
    label: "First-Touch Incrementality (FTI)",
    description: "See what % of your conversions come from genuinely new audiences. The playbook benchmark is 58%+.",
    color: "text-blue-400",
  },
  {
    icon: BarChart3,
    label: "Thumb-Stop Rate",
    description: "3-second video views ÷ impressions. Benchmark: 25%+. The single best hook-strength signal.",
    color: "text-violet-400",
  },
  {
    icon: Zap,
    label: "Hold Rate",
    description: "50% video views ÷ impressions. Benchmark: 15%+. Measures story strength beyond the hook.",
    color: "text-amber-400",
  },
  {
    icon: BarChart3,
    label: "CTR vs Brand BAU",
    description: "Your click-through rate benchmarked against your own brand average. Target: 13–20% above BAU.",
    color: "text-emerald-400",
  },
  {
    icon: AlertCircle,
    label: "Creative Similarity Score",
    description: "Meta's own measure of how alike your active assets are. Above ~60% triggers Entity ID collapse.",
    color: "text-red-400",
  },
  {
    icon: TrendingUp,
    label: "CPA Delta vs BAU",
    description: "Cost per acquisition for creator-led ads vs brand BAU. Benchmark: 10–25% lower.",
    color: "text-emerald-400",
  },
];

// ─── Access model explainer ───────────────────────────────────────────────────

const ACCESS_FACTS = [
  { icon: Eye, text: "Read-only — Tapline can view your data, never create, edit, or spend" },
  { icon: Clock, text: "90-day access window — expires automatically, no action needed" },
  { icon: Lock, text: "Revocable instantly — remove access from your Business Manager or TikTok Ads at any time" },
  { icon: Shield, text: "No passwords shared — access is granted via official partner/member invite, not credentials" },
];

// ─── Step components ──────────────────────────────────────────────────────────

function MetaSteps({ accountId }: { accountId?: string }) {
  const steps = [
    <>Log in to <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2 inline-flex items-center gap-1">Meta Business Manager <ExternalLink className="w-3 h-3" /></a></>,
    <>Go to <span className="font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">Business Settings → Users → Partners</span></>,
    <>Click <strong>Add</strong> and enter our partner business ID: <span className="font-mono text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">tapline-partner</span> (we'll confirm by email)</>,
    <>Under <strong>Assign Assets</strong>, select your Ad Account{accountId ? <span className="font-mono text-xs text-slate-400 ml-1">({accountId})</span> : ""}</>,
    <>Set the role to <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs ml-1">Analyst</Badge> — this is view-only, cannot create, edit, or spend</>,
    <>Click <strong>Save Changes</strong> — access expires automatically after 90 days</>,
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-blue-400 text-xs font-bold">{i + 1}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
        </div>
      ))}
    </div>
  );
}

function TikTokSteps({ advertiserId }: { advertiserId?: string }) {
  const steps = [
    <>Log in to <a href="https://ads.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2 inline-flex items-center gap-1">TikTok Ads Manager <ExternalLink className="w-3 h-3" /></a></>,
    <>Go to <span className="font-mono text-xs bg-white/10 px-1.5 py-0.5 rounded">Account → User Management → Members</span></>,
    <>Click <strong>Add Member</strong> and enter: <span className="font-mono text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">audit@tapline.co</span></>,
    <>Set the role to <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs ml-1">Viewer</Badge> — read-only, cannot create, edit, or spend</>,
    <>Set access expiry to <strong>90 days</strong></>,
    <>Click <strong>Confirm</strong> — you can remove access at any time from User Management</>,
  ];

  return (
    <div className="space-y-3">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-violet-400 text-xs font-bold">{i + 1}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountAccessPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"form" | "instructions" | "confirm" | "done">("form");
  const [accessId, setAccessId] = useState<number | null>(null);
  const [instructions, setInstructions] = useState<{
    meta?: string[];
    tiktok?: string[];
    summary: string;
  } | null>(null);

  const [form, setForm] = useState({
    brandName: "",
    brandSlug: "",
    contactEmail: "",
    metaAdAccountId: "",
    tiktokAdvertiserId: "",
    notes: "",
  });

  const requestMutation = trpc.accountAccess.request.useMutation({
    onSuccess: (data) => {
      setAccessId(data.accessId ?? null);
      setInstructions(data.instructions);
      setStep("instructions");
    },
    onError: (err) => {
      toast.error("Failed to submit request: " + err.message);
    },
  });

  const confirmMutation = trpc.accountAccess.confirmGrant.useMutation({
    onSuccess: () => {
      setStep("done");
    },
    onError: (err) => {
      toast.error("Failed to confirm: " + err.message);
    },
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandName || !form.contactEmail) {
      toast.error("Brand name and contact email are required");
      return;
    }
    if (!form.metaAdAccountId && !form.tiktokAdvertiserId) {
      toast.error("Please provide at least one account ID (Meta or TikTok)");
      return;
    }

    const slug =
      form.brandSlug ||
      form.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    requestMutation.mutate({
      brandName: form.brandName,
      brandSlug: slug,
      contactEmail: form.contactEmail,
      metaAdAccountId: form.metaAdAccountId || undefined,
      tiktokAdvertiserId: form.tiktokAdvertiserId || undefined,
      notes: form.notes || undefined,
    });
  };

  const handleConfirm = () => {
    if (!accessId) return;
    confirmMutation.mutate({
      accessId,
      metaGranted: !!form.metaAdAccountId,
      tiktokGranted: !!form.tiktokAdvertiserId,
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d0e14]">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tapline
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-500/20 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-sm font-medium text-slate-300">Account-Level Audit Access</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        {step === "form" && (
          <>
            <div className="text-center mb-12">
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 mb-4">
                Account-Level Audit
              </Badge>
              <h1 className="text-3xl font-bold text-white mb-4">
                Unlock your full performance picture
              </h1>
              <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
                The public audit shows what your competitors can see. The account-level audit shows
                what only you can see — and what's actually driving or limiting your results.
              </p>
            </div>

            {/* What you unlock */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
              {UNLOCKED_METRICS.map((metric) => (
                <div
                  key={metric.label}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4"
                >
                  <metric.icon className={`w-5 h-5 ${metric.color} mb-3`} />
                  <div className="text-sm font-semibold text-white mb-1">{metric.label}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{metric.description}</div>
                </div>
              ))}
            </div>

            {/* Access model — trust signals */}
            <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-6 mb-10">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-300">
                  Read-only access — zero risk
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ACCESS_FACTS.map((fact) => (
                  <div key={fact.text} className="flex items-start gap-2.5">
                    <fact.icon className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{fact.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white mb-2">Request account access</h2>
              <p className="text-sm text-slate-400 mb-6">
                Fill in your details and we'll send you step-by-step instructions to grant
                read-only access. The whole process takes under 3 minutes.
              </p>

              <form onSubmit={handleFormSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Brand name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={form.brandName}
                      onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                      placeholder="e.g. Ninja Kitchen UK"
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Contact email <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="email"
                      value={form.contactEmail}
                      onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                      placeholder="you@brand.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50"
                      required
                    />
                  </div>
                </div>

                <div className="border-t border-white/5 pt-5">
                  <p className="text-xs text-slate-500 mb-4">
                    Provide at least one account ID. You can find your Meta Ad Account ID in
                    Business Manager → Ad Accounts (format: act_XXXXXXXXX). Your TikTok Advertiser
                    ID is shown in TikTok Ads Manager → Account.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Meta Ad Account ID
                      </label>
                      <Input
                        value={form.metaAdAccountId}
                        onChange={(e) => setForm({ ...form, metaAdAccountId: e.target.value })}
                        placeholder="act_123456789"
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        TikTok Advertiser ID
                      </label>
                      <Input
                        value={form.tiktokAdvertiserId}
                        onChange={(e) => setForm({ ...form, tiktokAdvertiserId: e.target.value })}
                        placeholder="7123456789012345678"
                        className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Anything else we should know? (optional)
                  </label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="e.g. We have multiple ad accounts — the main one is act_..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 focus:border-blue-500/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={requestMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white h-11 font-medium"
                >
                  {requestMutation.isPending ? (
                    "Sending..."
                  ) : (
                    <>
                      Get access instructions
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </form>
            </div>
          </>
        )}

        {/* Step 2: Instructions */}
        {step === "instructions" && instructions && (
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Your access instructions are ready
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto">
                {instructions.summary}
              </p>
            </div>

            <div className="space-y-6">
              {instructions.meta && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <span className="text-blue-400 text-xs font-bold">M</span>
                    </div>
                    <span className="font-semibold text-white">Meta Business Manager</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs ml-auto">
                      Analyst role — view only
                    </Badge>
                  </div>
                  <MetaSteps accountId={form.metaAdAccountId} />
                </div>
              )}

              {instructions.tiktok && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <span className="text-violet-400 text-xs font-bold">T</span>
                    </div>
                    <span className="font-semibold text-white">TikTok Ads Manager</span>
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs ml-auto">
                      Viewer role — read only
                    </Badge>
                  </div>
                  <TikTokSteps advertiserId={form.tiktokAdvertiserId} />
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white h-11 font-medium"
              >
                {confirmMutation.isPending ? (
                  "Confirming..."
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    I've granted access
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("form")}
                className="flex-1 border-white/10 text-slate-300 hover:text-white h-11"
              >
                Go back
              </Button>
            </div>

            <p className="text-center text-xs text-slate-600 mt-4">
              We'll verify the connection within 24 hours and run your account-level audit automatically.
            </p>
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Access confirmed</h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              We've received your confirmation. Our team will verify the connection within 24 hours
              and your next audit will automatically include the full account-level metrics — FTI,
              thumb-stop rate, hold rate, CPA delta, and Creative Similarity Score.
            </p>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 text-left mb-8">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                What happens next
              </div>
              <div className="space-y-2.5">
                {[
                  "Tapline verifies the access grant (within 24 hours)",
                  "Your next audit runs with full account-level data",
                  "You receive an email when the enhanced audit is ready",
                  "Access expires automatically after 90 days — no action needed",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-400 text-xs font-bold">{i + 1}</span>
                    </div>
                    <span className="text-sm text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button
              onClick={() => navigate("/")}
              className="bg-blue-600 hover:bg-blue-500 text-white h-11 px-8 font-medium"
            >
              Back to Tapline
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
