/**
 * PDF Generator — Tapline
 * Generates a branded PDF audit report using Puppeteer.
 */

import type { Audit, AuditCompetitor } from "../drizzle/schema";

function fmtCurrency(n: number) {
  if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `£${(n / 1000).toFixed(0)}K`;
  return `£${n}`;
}

function fmt(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

function getGrade(score: number) {
  if (score >= 80) return { grade: "A", color: "#34d399" };
  if (score >= 65) return { grade: "B", color: "#60a5fa" };
  if (score >= 50) return { grade: "C", color: "#fbbf24" };
  if (score >= 35) return { grade: "D", color: "#fb923c" };
  return { grade: "F", color: "#f87171" };
}

function scoreBarSvg(score: number, color: string) {
  const width = Math.round((score / 100) * 300);
  return `
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 12px; color: #94a3b8;">${color === "#34d399" ? "Format" : color === "#60a5fa" ? "Partnership" : "Duration"} Score</span>
        <span style="font-size: 12px; font-weight: 700; color: #f1f5f9;">${score}/100</span>
      </div>
      <div style="height: 6px; background: #1e293b; border-radius: 3px; overflow: hidden;">
        <div style="height: 100%; width: ${score}%; background: ${score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171"}; border-radius: 3px;"></div>
      </div>
    </div>
  `;
}

export function generateAuditHTML(
  audit: Audit,
  competitors: AuditCompetitor[]
): string {
  const andromedaScore = audit.andromedaScore ?? 0;
  const formatScore = audit.formatScore ?? 0;
  const partnershipScore = audit.partnershipScore ?? 0;
  const durationScore = audit.durationScore ?? 0;
  const partnershipPct = ((audit.partnershipPct ?? 0) * 100).toFixed(1);
  const { grade, color: gradeColor } = getGrade(andromedaScore);
  const scoreColor = andromedaScore >= 70 ? "#34d399" : andromedaScore >= 50 ? "#fbbf24" : "#f87171";

  const formatBreakdown = audit.formatBreakdown ?? { video: 0, image: 0, carousel: 0, collection: 0 };
  const totalFmt = formatBreakdown.video + formatBreakdown.image + formatBreakdown.carousel + formatBreakdown.collection;

  const competitorRows = competitors
    .map((c) => {
      const pct = c.partnershipPct ?? 0;
      const pctColor = pct >= 30 ? "#34d399" : "#fbbf24";
      return `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #cbd5e1;">${c.brandName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: #cbd5e1;">${c.totalAds ?? 0}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: ${pctColor}; font-weight: 600;">${pct.toFixed(1)}%</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: #f1f5f9; font-weight: 700;">${c.andromedaScore ?? 0}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: #64748b; font-size: 11px;">${fmtCurrency(c.estimatedSpendMin ?? 0)} – ${fmtCurrency(c.estimatedSpendMax ?? 0)}</td>
        </tr>
      `;
    })
    .join("");

  const creatorGap = audit.creatorGapData;
  const gapCreators = creatorGap?.organicCreators.filter((c) => !c.inPaidPartnership) ?? [];

  const creatorCards = gapCreators
    .slice(0, 6)
    .map(
      (c) => `
      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <p style="font-weight: 600; font-size: 13px; color: #f1f5f9; margin: 0 0 2px;">${c.handle}</p>
            <p style="font-size: 11px; color: ${c.platform === "tiktok" ? "#f472b6" : "#60a5fa"}; margin: 0; text-transform: capitalize;">${c.platform}</p>
          </div>
          <span style="background: #451a03; color: #fbbf24; border: 1px solid #92400e; border-radius: 20px; padding: 2px 8px; font-size: 10px; font-weight: 600;">Gap Opportunity</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; text-align: center;">
          <div>
            <p style="font-size: 10px; color: #64748b; margin: 0 0 2px;">Followers</p>
            <p style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin: 0;">${fmt(c.followers)}</p>
          </div>
          <div>
            <p style="font-size: 10px; color: #64748b; margin: 0 0 2px;">Engagement</p>
            <p style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin: 0;">${c.avgEngagement.toFixed(1)}%</p>
          </div>
          <div>
            <p style="font-size: 10px; color: #64748b; margin: 0 0 2px;">Mentions</p>
            <p style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin: 0;">${c.brandMentions}</p>
          </div>
        </div>
      </div>
    `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tapline Audit — ${audit.brandName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #060b14;
      color: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page { max-width: 900px; margin: 0 auto; padding: 40px; }
    .section { margin-bottom: 32px; }
    h2 { font-size: 16px; font-weight: 700; margin-bottom: 16px; color: #f1f5f9; }
    .card { background: #0d1829; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; }
    @media print {
      body { background: #060b14 !important; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px; padding-bottom: 20px; border-bottom: 1px solid #1e293b;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <div style="width: 32px; height: 32px; background: #7c3aed; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 16px; font-weight: 800;">⚡</span>
      </div>
      <div>
        <span style="font-size: 18px; font-weight: 800; color: #f1f5f9;">Tapline</span>
        <span style="font-size: 11px; color: #64748b; margin-left: 8px;">Creator Partnership Audit</span>
      </div>
    </div>
    <div style="text-align: right;">
      <p style="font-size: 11px; color: #64748b;">Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      <p style="font-size: 11px; color: #64748b;">Period: ${audit.period}</p>
    </div>
  </div>

  <!-- Brand Hero -->
  <div class="card section" style="background: linear-gradient(135deg, #0d1829 0%, #130a2e 100%); border-color: #2d1b69;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="font-size: 28px; font-weight: 800; color: #f1f5f9; margin-bottom: 6px;">${audit.brandName}</h1>
        <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">${audit.totalAds ?? 0} ads analysed · ${audit.period} · Combined (Meta + TikTok)</p>
        <div style="display: flex; gap: 24px;">
          <div>
            <p style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Est. Spend</p>
            <p style="font-size: 14px; font-weight: 600; color: #f1f5f9;">${fmtCurrency(audit.estimatedSpendMin ?? 0)} – ${fmtCurrency(audit.estimatedSpendMax ?? 0)}</p>
          </div>
          <div>
            <p style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Est. Impressions</p>
            <p style="font-size: 14px; font-weight: 600; color: #f1f5f9;">${fmt(audit.estimatedImpressionsMin ?? 0)} – ${fmt(audit.estimatedImpressionsMax ?? 0)}</p>
          </div>
          <div>
            <p style="font-size: 11px; color: #64748b; margin-bottom: 2px;">Partnership Ads</p>
            <p style="font-size: 14px; font-weight: 600; color: ${parseFloat(partnershipPct) >= 30 ? "#34d399" : "#f87171"};">${partnershipPct}%</p>
          </div>
        </div>
      </div>
      <div style="text-align: center;">
        <div style="width: 80px; height: 80px; border-radius: 50%; border: 4px solid ${scoreColor}; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 20px ${scoreColor}40;">
          <span style="font-size: 24px; font-weight: 800; color: ${gradeColor};">${grade}</span>
          <span style="font-size: 12px; font-weight: 600; color: #f1f5f9;">${andromedaScore}</span>
        </div>
        <p style="font-size: 10px; color: #64748b; margin-top: 6px;">Andromeda Score</p>
      </div>
    </div>
  </div>

  <!-- KPI Grid -->
  <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;" class="section">
    ${[
      { label: "Total Ads", value: audit.totalAds ?? 0, color: "#60a5fa" },
      { label: "Partnership %", value: `${partnershipPct}%`, color: parseFloat(partnershipPct) >= 30 ? "#34d399" : "#f87171" },
      { label: "Format Score", value: formatScore, color: formatScore >= 70 ? "#34d399" : "#fbbf24" },
      { label: "Duration Score", value: durationScore, color: durationScore >= 70 ? "#34d399" : "#fbbf24" },
    ]
      .map(
        (k) => `
      <div class="card" style="text-align: center;">
        <p style="font-size: 10px; color: #64748b; margin-bottom: 6px;">${k.label}</p>
        <p style="font-size: 24px; font-weight: 800; color: ${k.color};">${k.value}</p>
      </div>
    `
      )
      .join("")}
  </div>

  <!-- Andromeda Score Breakdown -->
  <div class="card section">
    <h2>Andromeda Algorithm Score Breakdown</h2>
    <p style="font-size: 12px; color: #64748b; margin-bottom: 16px;">Tapline's proprietary creative diversity scoring engine. Partnership target: 30%+</p>
    ${scoreBarSvg(formatScore, "#34d399")}
    ${scoreBarSvg(partnershipScore, "#60a5fa")}
    ${scoreBarSvg(durationScore, "#94a3b8")}
    <div style="margin-top: 16px; padding: 12px; background: #0a0f1e; border-radius: 8px; border-left: 3px solid #7c3aed;">
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.6;">
        ${
          parseFloat(partnershipPct) < 30
            ? `Only ${partnershipPct}% of ads feature creator partnerships — well below the 30% Andromeda benchmark. Closing this gap with Tapline's creator network would significantly improve the overall score.`
            : `Strong creator partnership investment at ${partnershipPct}% — above the 30% benchmark. Focus on diversifying creator tiers for maximum impact.`
        }
      </p>
    </div>
  </div>

  <!-- Format Breakdown -->
  <div class="card section">
    <h2>Creative Format Breakdown</h2>
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
      ${[
        { label: "Video", value: formatBreakdown.video, color: "#7c3aed" },
        { label: "Image", value: formatBreakdown.image, color: "#0ea5e9" },
        { label: "Carousel", value: formatBreakdown.carousel, color: "#10b981" },
        { label: "Collection", value: formatBreakdown.collection, color: "#f59e0b" },
      ]
        .map(
          (f) => `
        <div style="text-align: center; padding: 12px; background: #0a0f1e; border-radius: 8px;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background: ${f.color}; margin: 0 auto 8px;"></div>
          <p style="font-size: 20px; font-weight: 700; color: #f1f5f9;">${f.value}</p>
          <p style="font-size: 11px; color: #64748b;">${f.label}</p>
          <p style="font-size: 10px; color: #475569;">${totalFmt > 0 ? ((f.value / totalFmt) * 100).toFixed(0) : 0}%</p>
        </div>
      `
        )
        .join("")}
    </div>
  </div>

  <!-- Creator Gap Analysis -->
  ${
    gapCreators.length > 0
      ? `
  <div class="section">
    <h2>Creator Partnership Gap Analysis</h2>
    <p style="font-size: 12px; color: #64748b; margin-bottom: 16px;">
      ${creatorGap?.gapCount ?? 0} creators are organically mentioning ${audit.brandName} but are not in paid partnerships. 
      Opportunity Score: <strong style="color: #7c3aed;">${creatorGap?.opportunityScore ?? 0}/100</strong>
    </p>
    ${creatorCards}
  </div>
  `
      : ""
  }

  <!-- Competitor Benchmarks -->
  ${
    competitors.length > 0
      ? `
  <div class="section">
    <h2>Competitor Benchmarks</h2>
    <table style="width: 100%; border-collapse: collapse; background: #0d1829; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
      <thead>
        <tr style="background: #0a0f1e;">
          <th style="padding: 10px 12px; text-align: left; font-size: 11px; color: #64748b; font-weight: 500;">Brand</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; color: #64748b; font-weight: 500;">Total Ads</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; color: #64748b; font-weight: 500;">Partnership %</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; color: #64748b; font-weight: 500;">Andromeda</th>
          <th style="padding: 10px 12px; text-align: right; font-size: 11px; color: #64748b; font-weight: 500;">Est. Spend</th>
        </tr>
      </thead>
      <tbody>
        <tr style="background: #130a2e;">
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-weight: 700;">⚡ ${audit.brandName}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: #f1f5f9;">${audit.totalAds ?? 0}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: ${parseFloat(partnershipPct) >= 30 ? "#34d399" : "#f87171"}; font-weight: 700;">${partnershipPct}%</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: #f1f5f9; font-weight: 700;">${andromedaScore}</td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; text-align: right; color: #64748b; font-size: 11px;">${fmtCurrency(audit.estimatedSpendMin ?? 0)} – ${fmtCurrency(audit.estimatedSpendMax ?? 0)}</td>
        </tr>
        ${competitorRows}
      </tbody>
    </table>
  </div>
  `
      : ""
  }

  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 24px; height: 24px; background: #7c3aed; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
        <span style="color: white; font-size: 12px;">⚡</span>
      </div>
      <span style="font-size: 13px; font-weight: 700; color: #f1f5f9;">Tapline</span>
    </div>
    <p style="font-size: 11px; color: #475569;">Powered by the Andromeda Algorithm · tapline.com · Confidential</p>
  </div>

</div>
</body>
</html>
  `;
}
