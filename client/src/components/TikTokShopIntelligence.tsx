import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Play,
  Star,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Zap,
  BarChart3,
  Video,
  Package,
} from "lucide-react";
import type { TikTokShopIntelligenceData, TikTokShopCreatorFE as TikTokShopCreator, TikTokShopProductFE as TikTokShopProduct, TikTokShopVideoFE as TikTokShopVideo } from "../types/audit";

interface Props {
  data: TikTokShopIntelligenceData;
  brandName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFollowers(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${n}`;
}

function formatViews(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${n}`;
}

const TIER_COLORS: Record<string, string> = {
  nano: "bg-zinc-800 text-zinc-300",
  micro: "bg-blue-950 text-blue-300",
  mid: "bg-violet-950 text-violet-300",
  macro: "bg-amber-950 text-amber-300",
  mega: "bg-rose-950 text-rose-300",
};

const HOOK_LABELS: Record<string, string> = {
  demo: "Product Demo",
  testimonial: "Testimonial",
  unboxing: "Unboxing",
  tutorial: "Tutorial",
  lifestyle: "Lifestyle",
  ugc: "UGC",
};

const TREND_ICON = {
  rising: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
  stable: <Minus className="w-3.5 h-3.5 text-zinc-400" />,
  declining: <TrendingDown className="w-3.5 h-3.5 text-rose-400" />,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CreatorRow({ creator, rank }: { creator: TikTokShopCreator; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0 group">
      {/* Rank */}
      <div className="w-6 text-center text-xs font-mono text-zinc-500 shrink-0">
        {rank <= 3 ? (
          <span className={rank === 1 ? "text-amber-400" : rank === 2 ? "text-zinc-300" : "text-amber-700"}>
            {rank === 1 ? "①" : rank === 2 ? "②" : "③"}
          </span>
        ) : (
          rank
        )}
      </div>

      {/* Handle + niche */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{creator.handle}</span>
          {creator.isPartnerOfBrand && (
            <Tooltip>
              <TooltipTrigger>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </TooltipTrigger>
              <TooltipContent>Already a partner</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${TIER_COLORS[creator.tier]}`}>
            {creator.tier}
          </span>
          <span className="text-[11px] text-zinc-500 truncate">{creator.niche}</span>
        </div>
      </div>

      {/* Followers */}
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-xs text-zinc-400">{formatFollowers(creator.followers)}</div>
        <div className="text-[10px] text-zinc-600">followers</div>
      </div>

      {/* Engagement */}
      <div className="text-right shrink-0 hidden md:block">
        <div className="text-xs text-zinc-400">{creator.avgEngagement.toFixed(1)}%</div>
        <div className="text-[10px] text-zinc-600">eng. rate</div>
      </div>

      {/* GMV */}
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-emerald-400">{creator.estimatedGmv}</div>
        <div className="text-[10px] text-zinc-600">est. GMV</div>
      </div>

      {/* Gap indicator */}
      {!creator.isPartnerOfBrand && (
        <Tooltip>
          <TooltipTrigger>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
          </TooltipTrigger>
          <TooltipContent>Untapped partnership opportunity</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: TikTokShopProduct }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white truncate">{product.productName}</span>
          {product.isCompetitorProduct && (
            <Badge variant="outline" className="text-[10px] border-rose-800 text-rose-400 shrink-0">
              {product.competitorBrand}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-zinc-500">{product.category}</span>
          <span className="text-[11px] text-zinc-600">·</span>
          <span className="text-[11px] text-zinc-500">{product.activeAffiliates.toLocaleString()} affiliates</span>
        </div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-xs text-zinc-400">£{product.price.toFixed(2)}</div>
        <div className="text-[10px] text-zinc-600">price</div>
      </div>
      <div className="text-right shrink-0 hidden md:block">
        <div className="text-xs text-emerald-400">{product.commissionRate}%</div>
        <div className="text-[10px] text-zinc-600">commission</div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1 justify-end">
          {TREND_ICON[product.trend]}
          <span className="text-xs text-zinc-400">{product.estimatedMonthlySales.toLocaleString()}</span>
        </div>
        <div className="text-[10px] text-zinc-600">mo. sales</div>
      </div>
    </div>
  );
}

function VideoRow({ video }: { video: TikTokShopVideo }) {
  const brandBadge = video.brandType === "target"
    ? <Badge className="text-[10px] bg-emerald-950 text-emerald-400 border-emerald-800">Your Brand</Badge>
    : video.brandType === "competitor"
    ? <Badge className="text-[10px] bg-rose-950 text-rose-400 border-rose-800">Competitor</Badge>
    : <Badge className="text-[10px] bg-zinc-800 text-zinc-400 border-zinc-700">Category</Badge>;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{video.creatorHandle}</span>
          {brandBadge}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-zinc-500">{HOOK_LABELS[video.hookType]}</span>
          <span className="text-[11px] text-zinc-600">·</span>
          <span className="text-[11px] text-zinc-500">{video.durationSeconds}s</span>
          <span className="text-[11px] text-zinc-600">·</span>
          <span className="text-[11px] text-zinc-500">{formatFollowers(video.creatorFollowers)} followers</span>
        </div>
      </div>
      <div className="text-right shrink-0 hidden sm:block">
        <div className="text-xs text-zinc-400">{formatViews(video.views)}</div>
        <div className="text-[10px] text-zinc-600">views</div>
      </div>
      <div className="text-right shrink-0 hidden md:block">
        <div className="text-xs text-blue-400">{video.conversionRate.toFixed(1)}%</div>
        <div className="text-[10px] text-zinc-600">CVR</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-semibold text-emerald-400">{video.estimatedGmv}</div>
        <div className="text-[10px] text-zinc-600">est. GMV</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TikTokShopIntelligenceSection({ data, brandName }: Props) {
  const untappedCreators = data.topCreatorsByGmv.filter((c) => !c.isPartnerOfBrand);
  const partnerCreators = data.topCreatorsByGmv.filter((c) => c.isPartnerOfBrand);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-5 h-5 text-[#69C9D0]" />
            <h2 className="text-xl font-semibold text-white">TikTok Shop Intelligence</h2>
            {data.isMock && (
              <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
                Demo Data
              </Badge>
            )}
          </div>
          <p className="text-sm text-zinc-400">
            Creator GMV rankings, trending products, and Shop video performance in the{" "}
            <span className="text-white font-medium">{data.category}</span> category · {data.country}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-zinc-500">Data as of</div>
          <div className="text-sm text-zinc-300">{data.dataAsOf}</div>
        </div>
      </div>

      {/* Category Benchmarks Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Avg Creator GMV", value: data.categoryBenchmarks.avgCreatorGmv, icon: <BarChart3 className="w-4 h-4 text-emerald-400" /> },
          { label: "Avg Conversion Rate", value: `${data.categoryBenchmarks.avgConversionRate}%`, icon: <TrendingUp className="w-4 h-4 text-blue-400" /> },
          { label: "Avg Commission", value: `${data.categoryBenchmarks.avgCommissionRate}%`, icon: <Star className="w-4 h-4 text-amber-400" /> },
          { label: "Top Creator Range", value: data.categoryBenchmarks.topCreatorFollowerRange, icon: <Users className="w-4 h-4 text-violet-400" /> },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {stat.icon}
              <span className="text-[11px] text-zinc-500">{stat.label}</span>
            </div>
            <div className="text-base font-semibold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Brand Shop Presence + Competitor Comparison */}
      {(data.brandShopPresence || (data.competitorShopData && data.competitorShopData.length > 0)) && (
        <Card className="bg-white/[0.03] border-white/[0.06]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#69C9D0]" />
              TikTok Shop Presence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left text-xs text-zinc-500 font-medium pb-2">Brand</th>
                    <th className="text-center text-xs text-zinc-500 font-medium pb-2">Shop</th>
                    <th className="text-right text-xs text-zinc-500 font-medium pb-2 hidden sm:table-cell">Products</th>
                    <th className="text-right text-xs text-zinc-500 font-medium pb-2 hidden md:table-cell">Affiliates</th>
                    <th className="text-right text-xs text-zinc-500 font-medium pb-2">Est. Mo. GMV</th>
                    <th className="text-center text-xs text-zinc-500 font-medium pb-2 hidden sm:table-cell">Open Collab</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Brand row */}
                  {data.brandShopPresence && (
                    <tr className="border-b border-white/5">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#69C9D0]" />
                          <span className="font-medium text-white">{brandName}</span>
                          <Badge className="text-[10px] bg-[#69C9D0]/10 text-[#69C9D0] border-[#69C9D0]/20">You</Badge>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        {data.brandShopPresence.hasShop ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 mx-auto" />
                        )}
                      </td>
                      <td className="py-2.5 text-right text-zinc-300 hidden sm:table-cell">
                        {data.brandShopPresence.totalProducts ?? "—"}
                      </td>
                      <td className="py-2.5 text-right text-zinc-300 hidden md:table-cell">
                        {data.brandShopPresence.activeAffiliates?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-emerald-400">
                        {data.brandShopPresence.estimatedMonthlyGmv ?? "—"}
                      </td>
                      <td className="py-2.5 text-center hidden sm:table-cell">
                        {data.brandShopPresence.openCollaboration ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-zinc-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  )}
                  {/* Competitor rows */}
                  {(data.competitorShopData ?? []).map((comp) => (
                    <tr key={comp.brandName} className="border-b border-white/5 last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                          <span className="text-zinc-300">{comp.brandName}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        {comp.hasShop ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-zinc-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-2.5 text-right text-zinc-400 hidden sm:table-cell">
                        {comp.totalProducts ?? "—"}
                      </td>
                      <td className="py-2.5 text-right text-zinc-400 hidden md:table-cell">
                        {comp.activeAffiliates?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2.5 text-right text-zinc-300">
                        {comp.estimatedMonthlyGmv ?? "—"}
                      </td>
                      <td className="py-2.5 text-center hidden sm:table-cell">
                        {comp.openCollaboration ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                        ) : (
                          <Minus className="w-4 h-4 text-zinc-600 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Creators by GMV */}
      <Card className="bg-white/[0.03] border-white/[0.06]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#69C9D0]" />
              Top Creators by GMV — {data.category}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {untappedCreators.length} untapped
              {partnerCreators.length > 0 && (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1" />
                  {partnerCreators.length} partnered
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data.topCreatorsByGmv.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-sm">No creator data available</div>
          ) : (
            data.topCreatorsByGmv.map((creator, i) => (
              <CreatorRow key={creator.handle} creator={creator} rank={i + 1} />
            ))
          )}
          {untappedCreators.length > 0 && (
            <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-amber-300">
                    {untappedCreators.length} high-GMV creators not yet partnered with {brandName}
                  </div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    Combined estimated GMV:{" "}
                    <span className="text-amber-400 font-medium">
                      {/* Sum up untapped GMV estimates */}
                      {untappedCreators.length} creators driving significant category revenue without a brand relationship
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trending Products + Top Videos side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trending Products */}
        {data.trendingProducts.length > 0 && (
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#69C9D0]" />
                Trending Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.trendingProducts.map((product) => (
                <ProductRow key={product.productId} product={product} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Shop Videos */}
        {data.topShopVideos.length > 0 && (
          <Card className="bg-white/[0.03] border-white/[0.06]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Video className="w-4 h-4 text-[#69C9D0]" />
                Top Shop Videos by GMV
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.topShopVideos.map((video) => (
                <VideoRow key={video.videoId} video={video} />
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upgrade prompt for official Affiliate API */}
      <div className="p-4 bg-[#69C9D0]/5 border border-[#69C9D0]/15 rounded-xl">
        <div className="flex items-start gap-3">
          <ShoppingBag className="w-5 h-5 text-[#69C9D0] mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-medium text-white mb-1">
              Unlock Full TikTok Shop Affiliate Intelligence
            </div>
            <div className="text-xs text-zinc-400 leading-relaxed">
              The data above uses TikTok Creative Center public data. With{" "}
              <span className="text-white">TikTok Shop Partner status</span>, Tapline can access the
              official Affiliate API — giving you verified creator GMV, real-time affiliate performance,
              product-level conversion rates, and the ability to search 30M+ creators by GMV, audience
              demographics, and brand affinity. Partner registration is free and typically approved in
              1–2 weeks.
            </div>
            <a
              href="https://partner.tiktokshop.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-[#69C9D0] hover:text-white transition-colors"
            >
              Apply for TikTok Shop Partner status
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
