"use client";

import jsPDF from "jspdf";
import { parse, isWithinInterval, format, startOfMonth, endOfMonth, addMonths, startOfYear, endOfYear, addYears, isSameDay, subDays, differenceInCalendarDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import type { CompletionData, ViewData } from "./KnowbyDataProvider";

// =========================
// Small helper functions
// These are utility functions we reuse in multiple places.
// =========================
function parseCsvDate(ds?: string): Date | null {
	if (!ds) return null;
	return parse(ds, "dd/MM/yyyy", new Date());
}

function clampRange(range?: DateRange): { from: Date; to: Date } {
	// Make sure the date range has full-day precision
	// (start at 00:00 and end at 23:59) so comparisons are consistent.
	const now = new Date();
	const from = new Date((range?.from ?? now).setHours(0, 0, 0, 0));
	const to = new Date((range?.to ?? now).setHours(23, 59, 59, 999));
	return { from, to };
}

function inRangeDate(ds: string | undefined, from: Date, to: Date) {
	// Check if a CSV date string falls within [from, to].
	if (!ds) return false;
	const d = parseCsvDate(ds);
	if (!d) return false;
	return isWithinInterval(d, { start: from, end: to });
}

function pct(n: number) {
	// Format a number as a percentage string with 2 decimals.
	return `${n.toFixed(2)}%`;
}

// Build a Date from a CSV row.
// If there is a parsedDateTime already, use it.
// Otherwise combine date (dd/MM/yyyy) + time (HH:mm:ss) if present.
function rowDateTime(row: any): Date | null {
	if (row?.parsedDateTime) return row.parsedDateTime as Date;
	const ds: string | undefined = row?.date;
	if (!ds) return null;
	const base = parse(ds, "dd/MM/yyyy", new Date());
	if (!row?.time) return base;
	const [hh, mm = "0", ss = "0"] = String(row.time).split(":");
	base.setHours(parseInt(hh) || 0, parseInt(mm) || 0, parseInt(ss) || 0, 0);
	return base;
}

// This is the shape of the data we compute for the PDF.
// Basically a summarised dashboard snapshot for the selected date range.
export type DashboardSummary = {
	periodLabel: string; // e.g., "01 Jan 2024 to 07 Jan 2024" or "All time (...)"
	compareLabel: string; // e.g., "vs last week" or "since start"
	isAllTime: boolean;

	// Key metrics shown at the top (KPIs)
	kpis: {
		activeMembers: number;
		knowbys: number;
		views: number;
		completions: number;
		completionRate: number; // value in [0..100]
	};

	// Deltas compare the current period vs the previous comparable period
	// (or null if there is no previous data to compare to).
	deltas: {
		membersPct: number | null;
		knowbysPct: number | null;
		viewsPct: number | null;
		completionsPct: number | null;
		rateDelta: number | null; // absolute percentage points change in completion rate
	};

	// Top lists and time buckets used in the Trend table
	topKnowbysByViews: Array<{ name: string; id?: string; views: number; completions: number }>;
	topMembersByActivity: Array<{ name: string; id?: string; actions: number }>; // actions = views + completions
	bucketMode: "daily" | "monthly" | "yearly";
	windowKind?: "day" | "week" | "month" | "year" | "custom";
	buckets: Array<{ label: string; views: number; completions: number }>;

	// Simple insights we show as bullets (e.g., busiest day)
	insights: {
		peakDate: { date: Date; total: number } | null;
		peakWeekday: { name: string; total: number } | null;
		peakHour: { hour: number; total: number } | null;
		avgViews: number;
		avgComps: number;
	};
};

// Decide how to group time (day, month, or year) based on how long the range is.
function determineBucketMode(from: Date, to: Date): "daily" | "monthly" | "yearly" {
	const spanDays = differenceInCalendarDays(to, from) + 1;
	if (spanDays > 1300) return "yearly"; // really long range → yearly
	if (spanDays > 92) return "monthly"; // a few months → monthly
	return "daily"; // otherwise show daily
}

// Identify if the selected range is exactly a day, week, month, year, or just a custom period.
function determineWindowKind(from: Date, to: Date): "day" | "week" | "month" | "year" | "custom" {
	if (isSameDay(from, to)) return "day";
	// Full month: starts at the first day and ends at that month's last day
	if (
		isSameDay(from, startOfMonth(from)) &&
		isSameDay(to, endOfMonth(from)) &&
		isSameDay(startOfMonth(from), startOfMonth(to))
	)
		return "month";
	// Full year: same idea but for Jan 1 → Dec 31
	if (
		isSameDay(from, startOfYear(from)) &&
		isSameDay(to, endOfYear(from)) &&
		isSameDay(startOfYear(from), startOfYear(to))
	)
		return "year";
	// 7 days → call it a week (simple heuristic)
	const spanDays = differenceInCalendarDays(to, from) + 1;
	if (spanDays === 7) return "week";
	return "custom";
}

// Given a range, return the equivalent previous period and a label like
// "last week" or "previous period". This is used to compute deltas.
function previousComparableRange(from: Date, to: Date): { from: Date; to: Date; label: string } {
	const kind = determineWindowKind(from, to);
	if (kind === "day") {
		const pf = subDays(from, 1);
		const pt = subDays(to, 1);
		return { from: pf, to: pt, label: "last day" };
	}
	if (kind === "week") {
		const pf = subDays(from, 7);
		const pt = subDays(to, 7);
		return { from: pf, to: pt, label: "last week" };
	}
	if (kind === "month") {
		const pf = startOfMonth(addMonths(from, -1));
		const pt = endOfMonth(addMonths(from, -1));
		return { from: pf, to: pt, label: "last month" };
	}
	if (kind === "year") {
		const pf = startOfYear(addYears(from, -1));
		const pt = endOfYear(addYears(from, -1));
		return { from: pf, to: pt, label: "last year" };
	}
	const len = differenceInCalendarDays(to, from) + 1;
	const pt = subDays(from, 1);
	const pf = subDays(pt, len - 1);
	return { from: pf, to: pt, label: "previous period" };
}

export function computeDashboardSummary(
	completions: CompletionData[],
	views: ViewData[],
	range?: DateRange
): DashboardSummary {
	// 1) Normalise dates and decide how we will group data (daily, monthly, yearly)
	const { from, to } = clampRange(range);
	const bucketMode = determineBucketMode(from, to);
	const windowKind = determineWindowKind(from, to);

	// 2) Find the earliest and latest dates in the whole dataset.
	// If the selected range equals that span, we call it "All time".
	let datasetMin: Date | null = null;
	let datasetMax: Date | null = null;
	const considerDate = (ds?: string) => {
		const d = parseCsvDate(ds);
		if (!d) return;
		if (!datasetMin || d < datasetMin) datasetMin = d;
		if (!datasetMax || d > datasetMax) datasetMax = d;
	};
	for (const r of views) considerDate(r?.date);
	for (const r of completions) considerDate(r?.date);

	const isAllTimeSelection = !!(datasetMin && datasetMax && isSameDay(from, datasetMin) && isSameDay(to, datasetMax));
	// Compute roughly how many months the selection spans.
	const monthsSpan = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
	// If it's really long (>= 24 months), group by year to keep tables readable.
	const effectiveBucketMode: "daily" | "monthly" | "yearly" = monthsSpan >= 24 ? "yearly" : bucketMode;

	// 3) Aggregate metrics for the selected period (one pass over all events)
	let v = 0, c = 0;
	const memberSet = new Set<string>();
	const knowbySet = new Set<string>();

	// Per-knowby stats for top lists
	const knowbyAgg = new Map<string, { name?: string; views: number; completions: number }>();
	const memberAgg = new Map<string, { name?: string; actions: number }>();

		// Helper that decides bucket labels (e.g., days, months, years)
		// and gives us a key function to drop events into the right bucket.
		const makeBucketizer = () => {
			let bFrom = from, bTo = to; let labels: string[] = [] as string[];
			const pushMonths = (start: Date, end: Date) => { let cur = startOfMonth(start); while (cur <= end) { labels.push(format(cur, "MMM yyyy")); cur = addMonths(cur, 1); } };
			if (windowKind === "week") { bFrom = new Date(from.setHours(0,0,0,0)); bTo = new Date(to.setHours(23,59,59,999)); let d = new Date(bFrom); while (d <= bTo) { labels.push(format(d, "dd/MM/yyyy")); d.setDate(d.getDate()+1); } }
			else if (windowKind === "month") { bFrom = startOfMonth(from); bTo = endOfMonth(from); labels = ["Week 1","Week 2","Week 3","Week 4"]; }
			else if (windowKind === "year") { bFrom = startOfYear(from); bTo = endOfYear(from); pushMonths(bFrom, bTo); }
			else if (effectiveBucketMode === "yearly") { bFrom = startOfYear(from); bTo = endOfYear(to); let y = startOfYear(bFrom); while (y <= bTo) { labels.push(format(y, "yyyy")); y = addYears(y, 1); } }
			else if (effectiveBucketMode === "monthly") { bFrom = startOfMonth(addMonths(to, -11)); bTo = endOfMonth(to); pushMonths(bFrom, bTo); }
			else { const start = new Date(to); start.setHours(0,0,0,0); start.setDate(start.getDate()-30); bFrom = start; bTo = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23,59,59,999); let d = new Date(start); while (d <= bTo) { labels.push(format(d, "dd/MM/yyyy")); d.setDate(d.getDate()+1); } }
			const keyFor = (ds: string) => { const d = parseCsvDate(ds)!; if (windowKind === "week") return format(d, "dd/MM/yyyy"); if (windowKind === "month") { const day = d.getDate(); if (day<=7) return "Week 1"; if (day<=14) return "Week 2"; if (day<=21) return "Week 3"; return "Week 4"; } if (windowKind === "year" || effectiveBucketMode === "monthly") return format(d, "MMM yyyy"); if (effectiveBucketMode === "daily") return format(d, "dd/MM/yyyy"); return format(d, "yyyy"); };
			return { bFrom, bTo, labels, keyFor };
		};
	const { bFrom: bucketFrom, bTo: bucketTo, labels: bucketLabels, keyFor: bucketKey } = makeBucketizer();

	// Prepare a map like { label -> { views, completions } }
	const buckets = new Map<string, { views: number; completions: number }>();
	for (const l of bucketLabels) buckets.set(l, { views: 0, completions: 0 });

	// Use bucketKey from the bucketizer for consistent mapping

	// Accumulators for insights (busiest day, weekday, and hour)
	const dayTotals = new Map<string, { date: Date; views: number; completions: number }>();
	const weekdayCounts = new Array(7).fill(0) as number[]; // 0=Sun
	const hourCounts = new Array(24).fill(0) as number[];
	let anyTime = false;

	// Combine views and completions in one array so we can loop once.
	const events: Array<any & { _kind: "views" | "completions" }> = [
		...views.map((r) => ({ ...r, _kind: "views" as const })),
		...completions.map((r) => ({ ...r, _kind: "completions" as const })),
	];

	for (const row of events) {
		const kind = row._kind;
		const ds = row?.date as string | undefined;
		const inSel = inRangeDate(ds, from, to);
		const inBucket = inRangeDate(ds, bucketFrom, bucketTo);

		if (inSel) {
			if (kind === "views") v += 1; else c += 1;
			// Count per-knowby and per-member to build Top lists later.
			const kid = row?.knowby_id as string | undefined; const kname = row?.knowby_name as string | undefined;
			if (kid) {
				const prev = knowbyAgg.get(kid) ?? { name: kname, views: 0, completions: 0 };
				if (kind === "views") prev.views += 1; else prev.completions += 1;
				if (!prev.name && kname) prev.name = kname;
				knowbyAgg.set(kid, prev);
				knowbySet.add(kid);
			}
			const mid = row?.member_id as string | undefined; const mname = row?.member_name as string | undefined;
			if (mid) { const prevM = memberAgg.get(mid) ?? { name: mname, actions: 0 }; prevM.actions += 1; if (!prevM.name && mname) prevM.name = mname; memberAgg.set(mid, prevM); memberSet.add(mid); }

			// insights rollups
			const dt = rowDateTime(row);
			if (dt) {
				const ymd = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
				if (!dayTotals.has(ymd)) dayTotals.set(ymd, { date: new Date(dt), views: 0, completions: 0 });
				const rec = dayTotals.get(ymd)!; if (kind === "views") rec.views += 1; else rec.completions += 1;
				weekdayCounts[dt.getDay()] += 1;
				anyTime = true; hourCounts[dt.getHours()] += 1;
			}
		}

		if (inBucket) { const key = ds ? bucketKey(ds) : undefined; if (key && buckets.has(key)) { const b = buckets.get(key)!; if (kind === "views") b.views += 1; else b.completions += 1; } }
	}

	const completionRate = v > 0 ? (c / v) * 100 : 0;

	// 4) Build the previous comparable period so we can compute deltas.
	const prev = previousComparableRange(from, to);
	let pv = 0, pc = 0;
	const pmemberSet = new Set<string>();
	const pknowbySet = new Set<string>();

	// Quick extra loop for the previous period (simpler than branching the main loop)
	for (const row of views) { if (inRangeDate(row?.date, prev.from, prev.to)) { pv += 1; const mid = (row as any)?.member_id as string | undefined; if (mid) pmemberSet.add(mid); const kid = (row as any)?.knowby_id as string | undefined; if (kid) pknowbySet.add(kid); } }
	for (const row of completions) { if (inRangeDate(row?.date, prev.from, prev.to)) { pc += 1; const mid = (row as any)?.member_id as string | undefined; if (mid) pmemberSet.add(mid); const kid = (row as any)?.knowby_id as string | undefined; if (kid) pknowbySet.add(kid); } }
	const prevRate = pv > 0 ? (pc / pv) * 100 : 0;

	const deltaMembersBase = memberSet.size === 0 && pmemberSet.size === 0 ? null : (pmemberSet.size > 0 ? ((memberSet.size - pmemberSet.size) / pmemberSet.size) * 100 : 100);
	const deltaKnowbysBase = knowbySet.size === 0 && pknowbySet.size === 0 ? null : (pknowbySet.size > 0 ? ((knowbySet.size - pknowbySet.size) / pknowbySet.size) * 100 : 100);
	const deltaViewsBase = v === 0 && pv === 0 ? null : (pv > 0 ? ((v - pv) / pv) * 100 : 100);
	const deltaCompletionsBase = c === 0 && pc === 0 ? null : (pc > 0 ? ((c - pc) / pc) * 100 : 100);
	const deltaRateBase = (completionRate === 0 && prevRate === 0) ? null : (completionRate - prevRate);

	const hasPrevData = pv > 0 || pc > 0 || pmemberSet.size > 0 || pknowbySet.size > 0;
	const suppressCompare = !hasPrevData; // if there is no previous data at all

	const deltaMembers = (suppressCompare) ? null : deltaMembersBase;
	const deltaKnowbys = (suppressCompare) ? null : deltaKnowbysBase;
	const deltaViews = (suppressCompare) ? null : deltaViewsBase;
	const deltaCompletions = (suppressCompare) ? null : deltaCompletionsBase;
	const deltaRate = (suppressCompare) ? null : deltaRateBase;

	// Top lists
	const topKnowbysByViews = Array.from(knowbyAgg.entries())
		.map(([id, v]) => ({ id, name: v.name ?? id, views: v.views, completions: v.completions }))
		.sort((a, b) => b.views - a.views)
		.slice(0, 5);

	const topMembersByActivity = Array.from(memberAgg.entries())
		.map(([id, v]) => ({ id, name: v.name ?? id, actions: v.actions }))
		.sort((a, b) => b.actions - a.actions)
		.slice(0, 5);

	// Flatten buckets to an array so we can render tables in order
	const bucketArray = bucketLabels.map((l) => ({ label: l, views: buckets.get(l)?.views ?? 0, completions: buckets.get(l)?.completions ?? 0 }));

	// 5) Work out the simple insights (busiest day/weekday/hour + averages)
	const days = Array.from(dayTotals.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
	let peakDate: { date: Date; total: number } | null = null; for (const d of days) { const total = d.views + d.completions; if (!peakDate || total > peakDate.total) peakDate = { date: d.date, total }; }
	const sumViews = days.reduce((s, d) => s + d.views, 0); const sumComps = days.reduce((s, d) => s + d.completions, 0);
	const avgViews = days.length ? sumViews / days.length : 0; const avgComps = days.length ? sumComps / days.length : 0;
	const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
	let peakWeekday: { name: string; total: number } | null = null; for (let i = 0; i < 7; i++) { if (!peakWeekday || weekdayCounts[i] > (peakWeekday?.total ?? -1)) peakWeekday = { name: weekdayNames[i], total: weekdayCounts[i] }; }
	let peakHour: { hour: number; total: number } | null = null; if (anyTime) { for (let h = 0; h < 24; h++) { if (!peakHour || hourCounts[h] > (peakHour?.total ?? -1)) peakHour = { hour: h, total: hourCounts[h] }; } }

	// 6) Create the final labels
	const isAllTime = !!(datasetMin && datasetMax && isSameDay(from, datasetMin) && isSameDay(to, datasetMax));
	const periodLabel = isAllTime
		? `All time (${format(from, "dd MMM yyyy")} to ${format(to, "dd MMM yyyy")})`
		: `${format(from, "dd MMM yyyy")} to ${format(to, "dd MMM yyyy")}`;

	const compareLabel = (suppressCompare ? "since start" : `vs ${prev.label}`);

	return {
		periodLabel,
		compareLabel,
		isAllTime: isAllTime,
		kpis: {
			activeMembers: memberSet.size,
			knowbys: knowbySet.size,
			views: v,
			completions: c,
			completionRate,
		},
		deltas: {
			membersPct: deltaMembers,
			knowbysPct: deltaKnowbys,
			viewsPct: deltaViews,
			completionsPct: deltaCompletions,
			rateDelta: deltaRate,
		},
		topKnowbysByViews,
		topMembersByActivity,
		bucketMode: effectiveBucketMode,
		windowKind,
		buckets: bucketArray,
		insights: { peakDate, peakWeekday, peakHour, avgViews, avgComps },
	};
}

export function exportDashboardPdf(
	completions: CompletionData[],
	views: ViewData[],
	range?: DateRange
) {
	// First we compute all the numbers/text we want to show using the helper above.
	const summary = computeDashboardSummary(completions, views, range);

	// Create a new A4 PDF. We use "pt" (points) so spacing is easy to reason about.
	const doc = new jsPDF({ unit: "pt", format: "a4" });
	const pageW = doc.internal.pageSize.getWidth();
	const pageH = doc.internal.pageSize.getHeight();
	const margin = 40; // side and bottom margin
	const topMargin = 50; 
	let y = topMargin;

	// Basic colors we reuse.
	const colors = {
		primary: { r: 32, g: 94, b: 214 }, // blue accent
		text: { r: 0, g: 0, b: 0 },
		mutedText: { r: 80, g: 80, b: 80 },
		border: { r: 220, g: 220, b: 220 },
		softFill: { r: 246, g: 248, b: 252 },
		headerFill: { r: 238, g: 243, b: 255 },
		zebra: { r: 248, g: 248, b: 248 },
	} as const;

	// Draw text so its right edge lines up at xRight 
	const rightAlign = (text: string, xRight: number, yv: number, fontSize = 8) => {
		doc.setFontSize(fontSize);
		const w = doc.getTextWidth(text);
		doc.text(text, xRight - w, yv);
	};

	// Draw a section title with a small colored bar and an underline.
	// Returns the new Y position so the next content can be placed below.
	const sectionHeader = (title: string, yTop: number) => {
		// Accent bar
		doc.setDrawColor(colors.primary.r, colors.primary.g, colors.primary.b);
		doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
		doc.rect(margin, yTop - 10, 4, 18, "F");
		// Title 
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
		doc.text(title, margin + 12, yTop + 4);
		// underline
		doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
		doc.line(margin, yTop + 10, pageW - margin, yTop + 10);
		return yTop + 15; 
	};

	// Draw a thin frame on the current page
	// Add a thin border around each page so the PDF looks more polished.
	const drawPageFrame = () => {
		doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
		doc.setLineWidth(1);
		doc.rect(24, 24, pageW - 48, pageH - 48, "S");
	};

	// Draw a soft "empty state" box when there is no data to show.
	const drawEmptyBox = (text: string, x: number, yTop: number, w: number, h: number) => {
		doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
		doc.setFillColor(colors.softFill.r, colors.softFill.g, colors.softFill.b);
		doc.rect(x, yTop, w, h, "FD");
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
		const tw = doc.getTextWidth(text);
		doc.text(text, x + (w - tw) / 2, yTop + h / 2);
		doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
	};

	// Generic table renderer used by the Top lists and Trend sections.
	// It wraps long text, auto-breaks pages, and re-draws the header on new pages.
	const drawTable = (
		header: string[],
		rows: string[][],
		x: number,
		yTop: number,
		colWidths: number[],
		numericCols: number[] = []
	) => {
		// local helpers
		const totalWidth = colWidths.reduce((a, b) => a + b, 0);
		const lineH = 10; // line height for body text 
		const cellPadX = 6; // left/right padding
		const cellPadY = 4; // top/bottom padding
		const headerH = 18; 
		const pageInnerBottom = pageH - margin - 10; // keep some space from footer line

		// function to (re)draw the header row (bold text)
		const drawHeader = (yHeaderTop: number) => {
			// header background
			doc.setFillColor(colors.headerFill.r, colors.headerFill.g, colors.headerFill.b);
			doc.rect(x, yHeaderTop, totalWidth, headerH, "F");
			// header text 
			doc.setFont("helvetica", "bold");
			doc.setFontSize(8);
			let cx = x;
			const headerBaseline = yHeaderTop + 10; 
			for (let i = 0; i < header.length; i++) {
				const text = header[i];
				if (numericCols.includes(i)) rightAlign(text, cx + colWidths[i] - cellPadX, headerBaseline);
				else doc.text(text, cx + cellPadX, headerBaseline);
				cx += colWidths[i];
			}
			return yHeaderTop + headerH; // returns the y-top of the first row
		};

		// draw header and start body (switch back to normal text for rows)
		let yyTop = drawHeader(yTop); // top of the first body row
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);

		for (let r = 0; r < rows.length; r++) {
			// compute wrapped lines and row height
			const row = rows[r];
			const wrapped: string[][] = [];
			let rowHeight = 0;
			for (let c = 0; c < row.length; c++) {
				const raw = row[c] ?? "";
				let lines: string[];
				if (numericCols.includes(c)) {
					lines = [raw];
				} else {
					const usable = Math.max(10, colWidths[c] - 2 * cellPadX);
					lines = doc.splitTextToSize(raw, usable) as string[];
				}
				wrapped.push(lines);
				rowHeight = Math.max(rowHeight, lines.length * lineH + 2 * cellPadY);
			}

			// Page break if needed (and redraw header on the new page).
			// After drawing the bold header we must reset the font so rows are NOT bold.
			if (yyTop + rowHeight > pageInnerBottom) {
				doc.addPage();
				drawPageFrame();
				yyTop = drawHeader(topMargin + 8);
				// reset font back to normal for body rows after header redraw
				doc.setFont("helvetica", "normal");
				doc.setFontSize(8);
			}

			// zebra background for the row
			if (r % 2 === 0) {
				doc.setFillColor(colors.zebra.r, colors.zebra.g, colors.zebra.b);
				doc.rect(x, yyTop, totalWidth, rowHeight, "F");
			}

			// draw text cells
			let cx2 = x;
			for (let c = 0; c < row.length; c++) {
				const lines = wrapped[c];
				if (numericCols.includes(c)) {
					// numeric: single line, vertically positioned to first baseline
					rightAlign(lines[0], cx2 + colWidths[c] - cellPadX, yyTop + cellPadY + lineH - 2);
				} else {
					let ly = yyTop + cellPadY + lineH - 2;
					for (const ln of lines) {
						doc.text(ln, cx2 + cellPadX, ly);
						ly += lineH;
					}
				}
				cx2 += colWidths[c];
			}

			yyTop += rowHeight; // advance to next row position
		}
		return yyTop + 5; // larger gap after table to separate from next title
	};

// Helper to render a simple table section (Top Knowbys / Top Members)
	const renderSimpleTableSection = (
		title: string,
		header: string[],
		rows: string[][],
		numericCols: number[],
		fixedColsWidth: number // sum of fixed widths for numeric cols
	) => {
		y = sectionHeader(title, y);
		doc.setFont("helvetica", "normal"); doc.setFontSize(8); y += 0; 
		if (!rows.length) { drawEmptyBox("No data.", margin, y, pageW - margin * 2, 36); y += 56; return; }
		const available = pageW - margin * 2; const firstCol = Math.max(200, available - fixedColsWidth);
		const colWidths = [firstCol, ...header.slice(1).map((_, i) => i === header.length - 2 ? fixedColsWidth - 80 : 80)];
		y = drawTable(header, rows, margin, y + 0, colWidths, numericCols) + 15; 
	};

	// Page frame border
	drawPageFrame();

	// ===== Header (title + period + compare) =====
	doc.setFont("helvetica", "bold");
	doc.setFontSize(16);
	doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
	doc.text("Knowby Dashboard Metrics", margin, y);
	doc.setFontSize(9);
	doc.setFont("helvetica", "normal");
	y += 20;
	// Show which date range this report covers
	doc.text(`Period: ${summary.periodLabel}`, margin, y);
	y += 14;
	doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
	// If there's no previous data we say "since start"; otherwise e.g. "vs last month"
	doc.text(summary.compareLabel, margin, y);
	doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
	y += 16;
	doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
	doc.line(margin, y, pageW - margin, y);
	y += 16;

	// ===== KPI row (2 columns x 3 rows layout) =====
	// This array pairs a KPI label with the value and optional delta text.
	const kpiItems: Array<[string, string, string | null]> = [
		["Active Members", String(summary.kpis.activeMembers), summary.deltas.membersPct == null ? null : `${summary.deltas.membersPct > 0 ? "+" : ""}${summary.deltas.membersPct.toFixed(2)}%`],
		["Knowbys", String(summary.kpis.knowbys), summary.deltas.knowbysPct == null ? null : `${summary.deltas.knowbysPct > 0 ? "+" : ""}${summary.deltas.knowbysPct.toFixed(2)}%`],
		["Views", String(summary.kpis.views), summary.deltas.viewsPct == null ? null : `${summary.deltas.viewsPct > 0 ? "+" : ""}${summary.deltas.viewsPct.toFixed(2)}%`],
		["Completions", String(summary.kpis.completions), summary.deltas.completionsPct == null ? null : `${summary.deltas.completionsPct > 0 ? "+" : ""}${summary.deltas.completionsPct.toFixed(2)}%`],
		["Completion Rate", pct(summary.kpis.completionRate || 0), summary.deltas.rateDelta == null ? null : `${summary.deltas.rateDelta > 0 ? "+" : ""}${summary.deltas.rateDelta.toFixed(2)} pts`],
	];

	const colW = (pageW - margin * 2 - 20) / 2; // 2 columns with 20px gap
	// Draw one KPI "card" with a light background.
	const drawKpi = (label: string, value: string, delta: string | null, x: number, yPos: number) => {
		// KPI card background
		doc.setFillColor(colors.softFill.r, colors.softFill.g, colors.softFill.b);
		doc.rect(x - 8, yPos - 12, colW - 8, 38, "F");
		// Label
		doc.setFont("helvetica", "normal");
		doc.setFontSize(8);
		doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
		doc.text(label, x, yPos);
		// Value
		doc.setFont("helvetica", "bold");
		doc.setFontSize(12);
		doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
		doc.text(value, x, yPos + 18);
		// Delta
		if (delta) {
			doc.setFont("helvetica", "normal");
			doc.setFontSize(8);
			const positive = !delta.startsWith("-");
			doc.setTextColor(positive ? 0 : 200, positive ? 150 : 0, 0);
			doc.text(delta, x + 120, yPos + 18);
			doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);
		}
	};

	// Render the KPIs in two columns; automatically wraps to the next row.
	let idx = 0;
	for (const [label, value, delta] of kpiItems) {
		const col = idx % 2;
		const row = Math.floor(idx / 2);
		const x = margin + col * (colW + 30);
		const yPos = y + row * 40;
		drawKpi(label, value, delta, x, yPos);
		idx++;
	}
	y += Math.ceil(kpiItems.length / 2) * 38 + 8;

			// --- Insights section (textual, no charts) ---
			const insights = summary.insights;

			// Write insights as wrapped bullets
			const wrapWidth = pageW - margin * 2;
			const addBullet = (text: string) => {
				const lines = doc.splitTextToSize(text, wrapWidth);
				doc.text(lines, margin + 14, y);
				y += lines.length * 10;
			};

			y = sectionHeader("Insights (in selected period)", y + 4);
			y += 6;
			doc.setFont("helvetica", "normal");
			doc.setFontSize(9);
			if (!summary.buckets.length && summary.kpis.views === 0 && summary.kpis.completions === 0) {
				drawEmptyBox("No activity in the selected period.", margin, y, pageW - margin * 2, 40);
				y += 48;
			} else {
				const bullets: string[] = [];
				if (insights.peakDate) bullets.push(`Busiest day: ${format(insights.peakDate.date, "dd MMM yyyy")} (${insights.peakDate.total.toLocaleString()} interactions)`);
				if (insights.peakWeekday) bullets.push(`Most active weekday: ${insights.peakWeekday.name} (${insights.peakWeekday.total.toLocaleString()} total)`);
				if (insights.peakHour) bullets.push(`Peak hour: ${String(insights.peakHour.hour).padStart(2, "0")}:00–${String((insights.peakHour.hour + 1) % 24).padStart(2, "0")}:00`);
				else bullets.push("Peak hour: insufficient timestamp data to determine.");
				bullets.push(`Average per day: ${insights.avgViews.toFixed(1)} views, ${insights.avgComps.toFixed(1)} completions`);

				// Prefix bullets with • and wrap each
				for (const b of bullets) {
					doc.text("•", margin, y);
					addBullet(b);
					y += 2;
				}
			}
			y += 4;

	// ===== Top Knowbys =====
	y += 8; 
			const tk = summary.topKnowbysByViews; const tkRows = tk.map(r => [r.name, String(r.views), String(r.completions)]);
	renderSimpleTableSection("Top Knowbys (by Views)", ["Knowby","Views","Completions"], tkRows, [1,2], 180);

	// ===== Top Members =====
	const tm = summary.topMembersByActivity; const tmRows = tm.map(r => [r.name, String(r.actions)]);
	y += 0; renderSimpleTableSection("Top Members (by Activity)", ["Member","Actions"], tmRows, [1], 100);

	// ===== Trend table =====
	// The title changes depending on the selection (week/month/year) or bucketing rules.
	const trendTitle = summary.windowKind === "year" ? "Yearly Trend (12 months)"
		: summary.windowKind === "month" ? "Monthly Trend (4 weeks)"
		: summary.windowKind === "week" ? "Weekly Trend (7 days)"
		: summary.bucketMode === "yearly" ? (summary.isAllTime ? "All-time Trend (by year)" : "Yearly Trend (by year)")
		: summary.bucketMode === "monthly" ? "Monthly Trend (last 12 months)" : "Daily Trend (last 31 days)";
	y = sectionHeader(trendTitle, y + 2);
	doc.setFont("helvetica", "normal");
	doc.setFontSize(10);
	y += 0; 
				// Show a fuller window depending on granularity
				let maxRows = summary.buckets.length;
				if (summary.bucketMode === "monthly") maxRows = Math.min(12, summary.buckets.length);
				else if (summary.bucketMode === "daily") maxRows = Math.min(31, summary.buckets.length);
				// For yearly we show all years; the table auto-breaks pages.
				const rows = summary.bucketMode === "yearly" ? summary.buckets : summary.buckets.slice(-maxRows);
	if (!rows.length) {
		drawEmptyBox("No data.", margin, y, pageW - margin * 2, 36);
		y += 44;
	} else {
		// For each row show (label, views, completions, and completion rate if views>0)
		const tableRows: string[][] = rows.map(r => [r.label, String(r.views), String(r.completions), r.views > 0 ? pct((r.completions / r.views) * 100) : "--%"]);
		y = drawTable(["Period","Views","Completions","Rate"], tableRows, margin, y + 0, [200,80,90,70], [1,2,3]) + 4; 
	}

	// ===== Footer =====
	// A small line + timestamp at the bottom so exported PDFs look professional.
	y += 8;
	doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
	doc.line(margin, pageH - margin - 16, pageW - margin, pageH - margin - 16);
	doc.setFontSize(9);
	doc.setTextColor(colors.mutedText.r, colors.mutedText.g, colors.mutedText.b);
	const ts = new Date();
	const timeStr = `${String(ts.getDate()).padStart(2, "0")}/${String(ts.getMonth() + 1).padStart(2, "0")}/${ts.getFullYear()} ${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}`;
	doc.text("Generated by Knowby Dashboard", margin, pageH - margin - 4);
	rightAlign(`Created: ${timeStr}`, pageW - margin, pageH - margin - 4, 9);
	doc.setTextColor(colors.text.r, colors.text.g, colors.text.b);

	// Build a clean filename based on the period label.
	const fileLabel = summary.periodLabel.replaceAll(" ", "").replaceAll("→", "-").replaceAll(":", "");
	const filename = `knowby-metrics-${fileLabel}.pdf`;
	doc.save(filename);
}

