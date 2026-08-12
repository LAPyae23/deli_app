import { jsPDF } from 'jspdf';

export type ExecutiveSummaryData = {
  generatedAt: string;
  platform: {
    totalGMV: number;
    todayGMV: number;
    todayOrders: number;
    todayCancelled: number;
    activeRiders: number;
    registeredRiders: number;
    avgPrepTime: number;
  };
  segmentation: {
    totalCustomers: number;
    topVipCount: number;
    sleepingBeautyCount: number;
    newNormalCount: number;
    churnedCount: number;
    churnRate: number;
  };
  operations: {
    activeOrders: number;
    slowPrepOrders: number;
    longDurationOrders: number;
    avgDurationMins: number;
    kitchenHotspots: Array<{
      township: string;
      activeOrders: number;
      restaurants: number;
      pressure: number;
    }>;
    topSlowRestaurants: Array<{ name: string; slowOrders: number }>;
    insight: string;
  };
};

function formatKs(n: number) {
  return `${Math.round(n || 0).toLocaleString('en-US')} Ks`;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Builds and downloads a professional FoodDash Executive Summary PDF.
 */
export function downloadExecutiveSummaryPdf(data: ExecutiveSummaryData) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 52;

  const ensureSpace = (need = 40) => {
    if (y + need > doc.internal.pageSize.getHeight() - 48) {
      doc.addPage();
      y = 52;
    }
  };

  const rule = () => {
    doc.setDrawColor(220, 50, 50);
    doc.setLineWidth(1.5);
    doc.line(marginX, y, pageW - marginX, y);
    y += 16;
  };

  // Header
  doc.setFillColor(230, 36, 41);
  doc.rect(0, 0, pageW, 72, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('FoodDash Executive Summary', marginX, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Super Admin Terminal · Confidential', marginX, 52);
  doc.text(formatWhen(data.generatedAt), pageW - marginX, 52, { align: 'right' });

  y = 96;
  doc.setTextColor(30, 30, 30);

  // Platform Overview
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('1. Platform Overview', marginX, y);
  y += 10;
  rule();

  doc.setFontSize(10);
  const platformRows: [string, string][] = [
    ['Total GMV (all-time)', formatKs(data.platform.totalGMV)],
    ["Today's GMV", formatKs(data.platform.todayGMV)],
    ["Today's Orders", String(data.platform.todayOrders)],
    ['Active Riders (online / registered)', `${data.platform.activeRiders} / ${data.platform.registeredRiders}`],
    ['Avg Prep Time (today)', data.platform.avgPrepTime > 0 ? `${data.platform.avgPrepTime} min` : '—'],
    ['Cancelled / Rejected (today)', String(data.platform.todayCancelled)],
  ];

  for (const [label, value] of platformRows) {
    ensureSpace(18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(value, pageW - marginX, y, { align: 'right' });
    y += 18;
  }

  y += 10;
  ensureSpace(36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text('2. Customer Segmentation Summary', marginX, y);
  y += 10;
  rule();

  doc.setFontSize(10);
  const seg = data.segmentation;
  const segRows: [string, string][] = [
    ['Total Customers (scored)', String(seg.totalCustomers)],
    ['Top VIP', String(seg.topVipCount)],
    ['Sleeping Beauties', String(seg.sleepingBeautyCount)],
    ['New / Normal', String(seg.newNormalCount)],
    ['Churn rate (idle >60d · ≤1 order)', `${seg.churnRate}%`],
    ['Churned customers (heuristic)', String(seg.churnedCount)],
  ];

  for (const [label, value] of segRows) {
    ensureSpace(18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(value, pageW - marginX, y, { align: 'right' });
    y += 18;
  }

  y += 10;
  ensureSpace(36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text('3. Kitchen & Operational Bottlenecks', marginX, y);
  y += 10;
  rule();

  doc.setFontSize(10);
  const ops = data.operations;
  const opsRows: [string, string][] = [
    ['Active orders (in-flight)', String(ops.activeOrders)],
    ['Slow prep orders (≥30 min)', String(ops.slowPrepOrders)],
    ['Long duration orders (≥55 min)', String(ops.longDurationOrders)],
    ['Avg end-to-end duration', `${ops.avgDurationMins} min`],
  ];

  for (const [label, value] of opsRows) {
    ensureSpace(18);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(label, marginX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(value, pageW - marginX, y, { align: 'right' });
    y += 18;
  }

  y += 8;
  ensureSpace(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Township kitchen pressure', marginX, y);
  y += 16;

  if (ops.kitchenHotspots.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text('No active township pressure detected.', marginX, y);
    y += 16;
  } else {
    for (const spot of ops.kitchenHotspots) {
      ensureSpace(16);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(
        `${spot.township}: ${spot.activeOrders} active · ${spot.restaurants} kitchens · pressure ${spot.pressure}`,
        marginX,
        y
      );
      y += 15;
    }
  }

  if (ops.topSlowRestaurants.length > 0) {
    y += 8;
    ensureSpace(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text('Restaurants with frequent slow prep', marginX, y);
    y += 16;
    for (const r of ops.topSlowRestaurants) {
      ensureSpace(16);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(`${r.name} — ${r.slowOrders} slow orders`, marginX, y);
      y += 15;
    }
  }

  y += 12;
  ensureSpace(48);
  doc.setFillColor(255, 245, 245);
  doc.roundedRect(marginX, y - 12, pageW - marginX * 2, 48, 6, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(180, 30, 30);
  doc.text('Ops Insight', marginX + 12, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const insightLines = doc.splitTextToSize(ops.insight || '—', pageW - marginX * 2 - 24);
  doc.text(insightLines, marginX + 12, y + 20);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(
      `FoodDash · Page ${i} of ${pageCount}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 24,
      { align: 'center' }
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`FoodDash_Executive_Summary_${stamp}.pdf`);
}
