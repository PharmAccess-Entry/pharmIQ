import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const BOT_TOKEN = "8890384452:AAEkKSGm4U-s9b6qGON9QqikvjoQrcI17FI";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Telegram API Helpers ────────────────────────────────────────────────────

async function sendTyping(chatId: number) {
  await fetch(`${API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`${API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await fetch(`${API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}

// ─── Keyboard Layouts ────────────────────────────────────────────────────────

const MAIN_MENU = {
  inline_keyboard: [
    [
      { text: "📊 Today's Sales", callback_data: "sales:today" },
      { text: "📅 This Week", callback_data: "sales:week" },
    ],
    [
      { text: "📆 Last 7 Days", callback_data: "sales:7d" },
      { text: "📉 Last 30 Days", callback_data: "sales:30d" },
    ],
    [
      { text: "📦 Stock Alerts", callback_data: "stock:low" },
      { text: "📈 Operations", callback_data: "ops:summary" },
    ],
    [
      { text: "🏆 Top Products", callback_data: "top:products" },
      { text: "🔍 Quick Dashboard", callback_data: "dash:overview" },
    ],
    [
      { text: "⚙️ Settings", callback_data: "info:settings" },
    ],
  ],
};

const QUICK_BACK = {
  inline_keyboard: [
    [
      { text: "📊 Today's Sales", callback_data: "sales:today" },
      { text: "📦 Stock", callback_data: "stock:low" },
    ],
    [
      { text: "🏆 Top Products", callback_data: "top:products" },
      { text: "‹ Main Menu", callback_data: "nav:menu" },
    ],
  ],
};

// ─── Date Range Helpers ──────────────────────────────────────────────────────

function getTimezoneOffsetString(tz: string, date: Date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const parts = dtf.formatToParts(date);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value;
    if (!tzName || tzName === 'GMT') return 'Z';
    return tzName.replace('GMT', '');
  } catch { return '+01:00'; }
}

function getDateRange(range: string, tz: string): { start: string; end: string; label: string; prevStart: string; prevEnd: string } {
  const now = new Date();
  const offset = getTimezoneOffsetString(tz, now);
  const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);

  const makeRange = (fromMsAgo: number, toMsAgo = 0) => {
    const from = new Date(now.getTime() - fromMsAgo);
    const to = new Date(now.getTime() - toMsAgo);
    const fromYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(from);
    const toYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(to);
    return {
      start: new Date(`${fromYmd}T00:00:00${offset}`).toISOString(),
      end: new Date(`${toYmd}T23:59:59.999${offset}`).toISOString(),
    };
  };

  if (range === 'today') {
    return {
      start: new Date(`${todayYmd}T00:00:00${offset}`).toISOString(),
      end: new Date(`${todayYmd}T23:59:59.999${offset}`).toISOString(),
      label: `Today — ${formatDate(todayYmd)}`,
      prevStart: makeRange(86400_000 * 2, 86400_000).start,
      prevEnd: makeRange(86400_000 * 2, 86400_000).end,
    };
  }
  if (range === 'week') {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now.getTime() - diffToMonday * 86400_000);
    const mondayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(monday);
    const prevMonday = new Date(monday.getTime() - 7 * 86400_000);
    const prevMondayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(prevMonday);
    const lastSunday = new Date(monday.getTime() - 86400_000);
    const lastSundayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(lastSunday);
    return {
      start: new Date(`${mondayYmd}T00:00:00${offset}`).toISOString(),
      end: new Date(`${todayYmd}T23:59:59.999${offset}`).toISOString(),
      label: `This Week (Mon–Today)`,
      prevStart: new Date(`${prevMondayYmd}T00:00:00${offset}`).toISOString(),
      prevEnd: new Date(`${lastSundayYmd}T23:59:59.999${offset}`).toISOString(),
    };
  }
  if (range === '7d') {
    const curr = makeRange(6 * 86400_000);
    const prev = makeRange(13 * 86400_000, 7 * 86400_000);
    return { ...curr, label: `Last 7 Days`, prevStart: prev.start, prevEnd: prev.end };
  }
  if (range === '30d') {
    const curr = makeRange(29 * 86400_000);
    const prev = makeRange(59 * 86400_000, 30 * 86400_000);
    return { ...curr, label: `Last 30 Days`, prevStart: prev.start, prevEnd: prev.end };
  }
  // fallback: today
  return {
    start: new Date(`${todayYmd}T00:00:00${offset}`).toISOString(),
    end: new Date(`${todayYmd}T23:59:59.999${offset}`).toISOString(),
    label: `Today — ${formatDate(todayYmd)}`,
    prevStart: makeRange(86400_000 * 2, 86400_000).start,
    prevEnd: makeRange(86400_000 * 2, 86400_000).end,
  };
}

// ─── Data Fetchers ───────────────────────────────────────────────────────────

async function fetchAnalytics(supabase: any, rid: string, start: string, end: string) {
  const validStatus = ['confirmed', 'cash_pos', 'cash_paid', 'pos_paid'];
  const invalidState = ['refunded', 'cancelled', 'rejected'];

  const { data: rawOrders } = await supabase
    .from('orders')
    .select('id, total, payment_status, status, created_at, order_items(id, qty, cost_price, menu_item_id)')
    .eq('restaurant_id', rid)
    .gte('created_at', start)
    .lte('created_at', end);

  const orders = (rawOrders || []).filter((o: any) =>
    validStatus.includes(o.payment_status) && !invalidState.includes(o.status)
  );

  const missingCostIds = new Set<string>();
  orders.forEach((o: any) => {
    (o.order_items || []).forEach((item: any) => {
      if (!(item.cost_price > 0) && item.menu_item_id) missingCostIds.add(item.menu_item_id);
    });
  });

  const costMap: Record<string, number> = {};
  if (missingCostIds.size > 0) {
    const { data: menuItems } = await supabase
      .from('menu_items').select('id, cost_price').in('id', Array.from(missingCostIds));
    (menuItems || []).forEach((m: any) => { costMap[m.id] = Number(m.cost_price) || 0; });
  }

  let revenue = 0, cash = 0, pos = 0, transfer = 0, cogs = 0;
  const dailyMap: Record<string, number> = {};
  const hourlyMap: Record<number, number> = {};

  orders.forEach((o: any) => {
    const amt = Number(o.total) || 0;
    revenue += amt;
    if (o.payment_status === 'cash_paid') cash += amt;
    else if (o.payment_status === 'pos_paid' || o.payment_status === 'cash_pos') pos += amt;
    else if (o.payment_status === 'confirmed') transfer += amt;
    (o.order_items || []).forEach((item: any) => {
      const cost = (item.cost_price > 0) ? Number(item.cost_price) : (costMap[item.menu_item_id] || 0);
      cogs += (item.qty || 0) * cost;
    });
    const day = o.created_at.split('T')[0];
    dailyMap[day] = (dailyMap[day] || 0) + amt;
    const hr = new Date(o.created_at).getHours();
    hourlyMap[hr] = (hourlyMap[hr] || 0) + amt;
  });

  return { revenue, cash, pos, transfer, cogs, grossProfit: revenue - cogs, txCount: orders.length, dailyMap, hourlyMap };
}

async function fetchExpenses(supabase: any, rid: string, start: string, end: string) {
  const { data } = await supabase.from('expenses').select('amount')
    .eq('restaurant_id', rid)
    .gte('expense_date', start.split('T')[0])
    .lte('expense_date', end.split('T')[0]);
  return (data || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
}

async function fetchTopProducts(supabase: any, rid: string, start: string, end: string, limit = 8) {
  const validStatus = ['confirmed', 'cash_pos', 'cash_paid', 'pos_paid'];
  const invalidState = ['refunded', 'cancelled', 'rejected'];
  const { data: orders } = await supabase
    .from('orders')
    .select('payment_status, status, order_items(name, qty, price)')
    .eq('restaurant_id', rid)
    .gte('created_at', start)
    .lte('created_at', end);

  const countMap: Record<string, { qty: number; rev: number }> = {};
  (orders || [])
    .filter((o: any) => validStatus.includes(o.payment_status) && !invalidState.includes(o.status))
    .forEach((o: any) => {
      (o.order_items || []).forEach((item: any) => {
        if (!countMap[item.name]) countMap[item.name] = { qty: 0, rev: 0 };
        countMap[item.name].qty += item.qty || 0;
        countMap[item.name].rev += (item.qty || 0) * (Number(item.price) || 0);
      });
    });
  return Object.entries(countMap)
    .sort((a, b) => b[1].rev - a[1].rev)
    .slice(0, limit)
    .map(([name, d]) => ({ name, ...d }));
}

// ─── Chart Builders ──────────────────────────────────────────────────────────

function buildDailyChart(dailyMap: Record<string, number>, maxBars = 7): string {
  const entries = Object.entries(dailyMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-maxBars);
  if (entries.length === 0) return '';
  const maxVal = Math.max(...entries.map(([, v]) => v), 1);
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const chartLine = entries.map(([, v]) => bars[Math.round((v / maxVal) * (bars.length - 1))]).join('');
  const dateLabels = entries.map(([d]) => {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-NG', { weekday: 'short' }).slice(0, 2);
  }).join(' ');
  return `<code>${chartLine}</code>\n<code>${dateLabels}</code>`;
}

function buildHourlyChart(hourlyMap: Record<number, number>): string {
  const hours = [0, 3, 6, 9, 12, 15, 18, 21];
  const vals = hours.map(h => {
    let sum = 0;
    for (let i = h; i < h + 3; i++) sum += hourlyMap[i] || 0;
    return sum;
  });
  const maxVal = Math.max(...vals, 1);
  const bars = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const chartLine = vals.map(v => bars[Math.round((v / maxVal) * (bars.length - 1))]).join('');
  const labels = ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'];
  const shortLabels = labels.map(l => l.replace('am', '').replace('pm', '').padStart(2)).join('  ');
  return `<code>${chartLine}</code>\n<code>${shortLabels}</code>`;
}

// ─── AI Insight Generator ────────────────────────────────────────────────────

function generateInsights(curr: any, prev: any, currExp: number, prevExp: number): string[] {
  const insights: string[] = [];

  // Revenue comparison
  if (prev.revenue > 0) {
    const revPct = ((curr.revenue - prev.revenue) / prev.revenue) * 100;
    const icon = revPct >= 0 ? '📈' : '📉';
    const dir = revPct >= 0 ? 'up' : 'down';
    insights.push(`${icon} Revenue is <b>${dir} ${Math.abs(revPct).toFixed(1)}%</b> vs the previous period`);
  }

  // Order volume comparison
  if (prev.txCount > 0) {
    const txPct = ((curr.txCount - prev.txCount) / prev.txCount) * 100;
    if (Math.abs(txPct) > 5) {
      const icon = txPct >= 0 ? '🔥' : '🥶';
      insights.push(`${icon} Order volume is <b>${txPct >= 0 ? '+' : ''}${txPct.toFixed(0)}%</b> vs previous period (${curr.txCount} vs ${prev.txCount} orders)`);
    }
  }

  // Expense alert
  if (currExp > 0 && curr.revenue > 0) {
    const expRatio = (currExp / curr.revenue) * 100;
    if (expRatio > 30) {
      insights.push(`⚠️ Expenses are <b>${expRatio.toFixed(0)}%</b> of revenue — consider reviewing spending`);
    }
  }

  // Profit margin insight
  if (curr.revenue > 0) {
    const margin = ((curr.grossProfit) / curr.revenue) * 100;
    if (margin < 20) {
      insights.push(`💡 Gross margin is <b>${margin.toFixed(1)}%</b> — COGS may be high relative to sales price`);
    } else if (margin > 60) {
      insights.push(`✨ Excellent gross margin of <b>${margin.toFixed(1)}%</b> — great pricing!`);
    }
  }

  // Best day from daily map
  const daily = Object.entries(curr.dailyMap || {});
  if (daily.length > 1) {
    const best = daily.sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    if (best) {
      const bestDate = new Date(`${best[0]}T12:00:00Z`);
      const dayName = bestDate.toLocaleDateString('en-NG', { weekday: 'long' });
      insights.push(`🏅 Best day was <b>${dayName}</b> with ${curr.revenue > 0 ? fmt(best[1] as number) : '₦0'} in revenue`);
    }
  }

  // Payment channel insight
  if (curr.revenue > 0) {
    const dominant = curr.cash >= curr.pos && curr.cash >= curr.transfer ? 'cash' :
                     curr.pos >= curr.transfer ? 'POS terminal' : 'bank transfer';
    const domAmt = Math.max(curr.cash, curr.pos, curr.transfer);
    const domPct = ((domAmt / curr.revenue) * 100).toFixed(0);
    insights.push(`💳 <b>${domPct}%</b> of revenue came via <b>${dominant}</b>`);
  }

  return insights.slice(0, 3); // Return top 3 most relevant insights
}

// ─── Report Builders ─────────────────────────────────────────────────────────

async function buildSalesReport(supabase: any, rid: string, sym: string, tz: string, range: string, name: string) {
  const { start, end, label, prevStart, prevEnd } = getDateRange(range, tz);

  const [curr, prev, currExp, prevExp] = await Promise.all([
    fetchAnalytics(supabase, rid, start, end),
    fetchAnalytics(supabase, rid, prevStart, prevEnd),
    fetchExpenses(supabase, rid, start, end),
    fetchExpenses(supabase, rid, prevStart, prevEnd),
  ]);

  const netProfit = curr.grossProfit - currExp;
  const aov = curr.txCount > 0 ? curr.revenue / curr.txCount : 0;
  const marginPct = curr.revenue > 0 ? ((curr.grossProfit / curr.revenue) * 100).toFixed(1) : '0.0';
  const netIcon = netProfit >= 0 ? '🟢' : '🔴';

  // Daily chart (multi-day) or hourly chart (today)
  const isToday = range === 'today';
  const chartTitle = isToday ? '⏱ Hourly Activity' : '📈 Revenue Trend';
  const chart = isToday
    ? buildHourlyChart(curr.hourlyMap)
    : buildDailyChart(curr.dailyMap);

  // % vs previous
  const revDelta = prev.revenue > 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : null;
  const revDeltaStr = revDelta !== null
    ? ` <i>(${revDelta >= 0 ? '+' : ''}${revDelta.toFixed(1)}%)</i>`
    : '';

  const insights = generateInsights(curr, prev, currExp, prevExp);

  const lines = [
    `📊 <b>${name}</b>`,
    `📅 <i>${label}</i>`,
    '',
    chart ? `<b>${chartTitle}:</b>\n${chart}` : '',
    chart ? '━━━━━━━━━━━━━━━━━━━━' : '━━━━━━━━━━━━━━━━━━━━',
    `💰 Revenue:     <b>${sym}${fmt(curr.revenue)}</b>${revDeltaStr}`,
    `📦 COGS:        ${sym}${fmt(curr.cogs)}`,
    `📉 Expenses:    ${sym}${fmt(currExp)}`,
    `${netIcon} Net Profit:  <b>${sym}${fmt(netProfit)}</b>`,
    '',
    `🧾 Orders:      <b>${curr.txCount}</b>`,
    `💡 Avg Order:   ${sym}${fmt(aov)}`,
    `📐 Gross Margin: ${marginPct}%`,
    '━━━━━━━━━━━━━━━━━━━━',
    `<b>💵 Cash Flow:</b>`,
    `  💵 Cash:      ${sym}${fmt(curr.cash)}`,
    `  💳 POS:       ${sym}${fmt(curr.pos)}`,
    `  🏦 Transfer:  ${sym}${fmt(curr.transfer)}`,
    ...(insights.length > 0 ? ['━━━━━━━━━━━━━━━━━━━━', `<b>🤖 AI Insights:</b>`, ...insights.map(i => `  ${i}`)] : []),
  ].filter(l => l !== null && l !== '').join('\n');

  return lines;
}

async function buildStockReport(supabase: any, rid: string) {
  const { data: all } = await supabase
    .from('menu_items')
    .select('name, stock_quantity, low_stock_threshold')
    .eq('restaurant_id', rid)
    .eq('track_inventory', true);

  const items = (all || []);
  const outOfStock = items.filter((i: any) => Number(i.stock_quantity) <= 0);
  const low = items.filter((i: any) => Number(i.stock_quantity) > 0 && Number(i.stock_quantity) <= Number(i.low_stock_threshold));
  const healthy = items.length - outOfStock.length - low.length;

  const lines: string[] = [
    `📦 <b>Inventory Status — ${items.length} tracked items</b>`,
    '',
    `🔴 Out of stock: <b>${outOfStock.length}</b>   🟡 Low: <b>${low.length}</b>   🟢 Healthy: <b>${healthy}</b>`,
    '━━━━━━━━━━━━━━━━━━━━',
  ];

  if (outOfStock.length > 0) {
    lines.push(`\n🔴 <b>OUT OF STOCK (${outOfStock.length}):</b>`);
    outOfStock.slice(0, 8).forEach((i: any) => lines.push(`  • ${i.name}`));
  }

  if (low.length > 0) {
    lines.push(`\n🟡 <b>RUNNING LOW (${low.length}):</b>`);
    low.sort((a: any, b: any) => Number(a.stock_quantity) - Number(b.stock_quantity))
      .slice(0, 10)
      .forEach((i: any) => {
        const pct = Math.round((Number(i.stock_quantity) / (Number(i.low_stock_threshold) * 2)) * 100);
        const barLen = Math.min(Math.round(pct / 12.5), 8);
        const bar = '█'.repeat(barLen) + '░'.repeat(8 - barLen);
        lines.push(`  • ${i.name}\n    <code>${bar}</code> ${i.stock_quantity} left`);
      });
  }

  if (outOfStock.length === 0 && low.length === 0) {
    lines.push(`\n✅ <b>All stocked up!</b>\nAll ${items.length} tracked products are above their alert thresholds. 🎉`);
  }

  if (outOfStock.length + low.length > 0) {
    lines.push('');
    lines.push(`💡 <i>Restock these items to avoid missed sales.</i>`);
  }

  return lines.join('\n');
}

async function buildTopProducts(supabase: any, rid: string, sym: string, tz: string, range: string, name: string) {
  const { start, end, label } = getDateRange(range, tz);
  const products = await fetchTopProducts(supabase, rid, start, end, 8);

  if (products.length === 0) {
    return `🏆 <b>Top Products — ${name}</b>\n📅 <i>${label}</i>\n\n🚫 No sales recorded for this period.`;
  }

  const maxRev = products[0].rev;
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

  const lines = [
    `🏆 <b>Top Products — ${name}</b>`,
    `📅 <i>${label}</i>`,
    '━━━━━━━━━━━━━━━━━━━━',
    ...products.map((p, i) => {
      const barLen = Math.round((p.rev / maxRev) * 8);
      const bar = '█'.repeat(barLen) + '░'.repeat(8 - barLen);
      return `${medals[i]} <b>${p.name}</b>\n   <code>${bar}</code> ${sym}${fmt(p.rev)} · ${p.qty} sold`;
    }),
    '━━━━━━━━━━━━━━━━━━━━',
    `💡 <i>Top earner generated ${((products[0].rev / products.reduce((s, p) => s + p.rev, 0)) * 100).toFixed(0)}% of total product revenue</i>`,
  ];
  return lines.join('\n');
}

async function buildOpsReport(supabase: any, rid: string, tz: string) {
  const now = new Date();
  const offset = getTimezoneOffsetString(tz, now);
  const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const start = new Date(`${todayYmd}T00:00:00${offset}`).toISOString();

  const { data: orders } = await supabase
    .from('orders')
    .select('status, payment_status, total')
    .eq('restaurant_id', rid)
    .gte('created_at', start);

  let pending = 0, preparing = 0, served = 0, completed = 0, cancelled = 0;
  let unpaidTotal = 0, unpaidCount = 0;

  (orders || []).forEach((o: any) => {
    if (o.status === 'pending') pending++;
    else if (o.status === 'preparing') preparing++;
    else if (o.status === 'served') served++;
    else if (o.status === 'completed') completed++;
    else if (o.status === 'cancelled' || o.status === 'rejected') cancelled++;
    if (o.payment_status === 'unpaid' && o.status !== 'cancelled' && o.status !== 'rejected') {
      unpaidCount++;
      unpaidTotal += Number(o.total) || 0;
    }
  });

  const total = (orders || []).length;
  const active = pending + preparing + served;

  return [
    `📈 <b>Operational Overview</b>`,
    `📅 <i>${formatDate(todayYmd)}</i>`,
    '━━━━━━━━━━━━━━━━━━━━',
    `📋 <b>Total Orders Today:</b>  ${total}`,
    `⚡ <b>Active Right Now:</b>    ${active}`,
    '',
    `<b>📌 Order Pipeline:</b>`,
    `  ⏳ Pending:    <b>${pending}</b>`,
    `  🔥 Preparing:  <b>${preparing}</b>`,
    `  ✅ Served:     <b>${served}</b>`,
    `  🎯 Completed:  <b>${completed}</b>`,
    `  ❌ Cancelled:  ${cancelled}`,
    '━━━━━━━━━━━━━━━━━━━━',
    unpaidCount > 0
      ? `💸 <b>${unpaidCount} unpaid order${unpaidCount !== 1 ? 's' : ''}</b> totalling <b>₦${fmt(unpaidTotal)}</b> — chase these up!`
      : `✅ <b>All orders are settled.</b> Great work! 🎉`,
  ].join('\n');
}

async function buildDashboard(supabase: any, rid: string, sym: string, tz: string, name: string) {
  const now = new Date();
  const offset = getTimezoneOffsetString(tz, now);
  const todayYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
  const start = new Date(`${todayYmd}T00:00:00${offset}`).toISOString();
  const end = new Date(`${todayYmd}T23:59:59.999${offset}`).toISOString();

  const yesterday = new Date(now.getTime() - 86400_000);
  const ystdYmd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(yesterday);
  const ystdStart = new Date(`${ystdYmd}T00:00:00${offset}`).toISOString();
  const ystdEnd = new Date(`${ystdYmd}T23:59:59.999${offset}`).toISOString();

  const [today, ystd, expenses, stockData, ops] = await Promise.all([
    fetchAnalytics(supabase, rid, start, end),
    fetchAnalytics(supabase, rid, ystdStart, ystdEnd),
    fetchExpenses(supabase, rid, start, end),
    supabase.from('menu_items').select('stock_quantity, low_stock_threshold').eq('restaurant_id', rid).eq('track_inventory', true),
    supabase.from('orders').select('status, payment_status').eq('restaurant_id', rid).gte('created_at', start),
  ]);

  const netProfit = today.grossProfit - expenses;
  const revDelta = ystd.revenue > 0 ? ((today.revenue - ystd.revenue) / ystd.revenue) * 100 : null;
  const revArrow = revDelta === null ? '' : revDelta >= 0 ? ` ▲${revDelta.toFixed(1)}%` : ` ▼${Math.abs(revDelta).toFixed(1)}%`;

  const stockItems = stockData.data || [];
  const lowCount = stockItems.filter((i: any) => Number(i.stock_quantity) <= Number(i.low_stock_threshold)).length;

  const ordersToday = ops.data || [];
  const activeOrders = ordersToday.filter((o: any) => ['pending', 'preparing', 'served'].includes(o.status)).length;
  const unpaid = ordersToday.filter((o: any) => o.payment_status === 'unpaid' && !['cancelled', 'rejected'].includes(o.status)).length;

  const hr = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now));
  const greeting = hr < 12 ? '🌅 Good morning' : hr < 17 ? '☀️ Good afternoon' : '🌙 Good evening';

  return [
    `${greeting}, <b>${name}</b>!`,
    `📅 <i>${formatDate(todayYmd)}</i>`,
    '━━━━━━━━━━━━━━━━━━━━',
    `💰 Today's Revenue: <b>${sym}${fmt(today.revenue)}</b>${revArrow}`,
    `${netProfit >= 0 ? '🟢' : '🔴'} Net Profit:     <b>${sym}${fmt(netProfit)}</b>`,
    `🧾 Orders:          <b>${today.txCount}</b>`,
    '━━━━━━━━━━━━━━━━━━━━',
    `⚡ Active Orders:  <b>${activeOrders}</b>`,
    `💸 Unpaid:         <b>${unpaid}</b>`,
    `📦 Low Stock Items: <b>${lowCount}</b>`,
    '━━━━━━━━━━━━━━━━━━━━',
    today.txCount > 0 ? `<b>⏱ Hourly Activity:</b>\n${buildHourlyChart(today.hourlyMap)}` : '',
    '',
    `<i>Last updated: ${now.toLocaleTimeString('en-NG', { timeZone: tz, hour: '2-digit', minute: '2-digit' })}</i>`,
  ].filter(l => l !== null && l !== '').join('\n');
}

// ─── Natural Language Understanding ─────────────────────────────────────────

function detectIntent(text: string): { action: string; range: string } | null {
  const t = text.toLowerCase().replace(/[?!.,]/g, '');

  let range = 'today';
  if (t.match(/this week|current week/)) range = 'week';
  else if (t.match(/last 30|this month|past month|30 days/)) range = '30d';
  else if (t.match(/last 7|past week|7 days/)) range = '7d';
  else if (t.match(/today|right now|so far|current|now/)) range = 'today';

  if (t.match(/stock|inventory|low|out of stock|running out|shortage|restock|empty/))
    return { action: 'stock', range };
  if (t.match(/top|best|selling|popular|product|item|what sold|most ordered/))
    return { action: 'top_products', range };
  if (t.match(/cash|flow|payment|pos|transfer|breakdown|how.*paid|payment method|how much did we make/))
    return { action: 'sales', range };
  if (t.match(/operation|order|queue|pending|pipeline|active|how many order/))
    return { action: 'ops', range };
  if (t.match(/profit|revenue|sales|earn|income|money|report|performance|doing|business|how.*going|numbers|how much/))
    return { action: 'sales', range };
  if (t.match(/dashboard|overview|summary|quick view|snapshot/))
    return { action: 'dashboard', range };
  if (t.match(/help|what can|command|how to use|feature/))
    return { action: 'help', range };
  if (t.match(/^(hi|hello|hey|good morning|good afternoon|good evening|yo|sup|what.?s up)/))
    return { action: 'greeting', range };

  return null;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(ymd: string) {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-NG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function buildWelcomeMessage(firstName: string, bizName: string, showHint = false) {
  return [
    `👋 Welcome back, <b>${firstName}!</b>`,
    '',
    `I'm your <b>PharmIQ AI Assistant</b> for <b>${bizName}</b>.`,
    `I have live access to your sales, inventory, and operations.`,
    '',
    showHint ? `💡 <i>Tap any button or just type naturally — I understand plain English!</i>` : `Tap any button below to get instant insights 👇`,
  ].join('\n');
}

// ─── Core Handler ────────────────────────────────────────────────────────────

async function handleCommand(
  supabase: any,
  chatId: number,
  action: string,
  range: string,
  rid: string,
  tz: string,
  sym: string,
  name: string,
  firstName: string,
  messageId?: number,
) {
  const respond = async (text: string, markup?: any) => {
    const kb = markup ?? QUICK_BACK;
    if (messageId) {
      await editMessage(chatId, messageId, text, kb);
    } else {
      await sendMessage(chatId, text, kb);
    }
  };

  if (action === 'menu') {
    await respond(buildWelcomeMessage(firstName, name, true), MAIN_MENU);
    return;
  }

  if (action === 'help') {
    const helpText = [
      `🤖 <b>PharmIQ AI Assistant</b>`,
      '',
      `You don't need to memorize commands — just <b>tap buttons</b> or type naturally:`,
      '',
      `<i>"How are sales today?"</i>`,
      `<i>"Show me what's out of stock"</i>`,
      `<i>"What are my top products this week?"</i>`,
      `<i>"Give me a dashboard overview"</i>`,
      '',
      `👇 Or pick from the menu below:`,
    ].join('\n');
    await respond(helpText, MAIN_MENU);
    return;
  }

  if (action === 'greeting') {
    const now = new Date();
    const hr = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(now));
    const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const msg = [
      `${greet}, <b>${firstName}!</b> 👋`,
      '',
      `Ready to check on <b>${name}</b>? Tap a button below or ask me anything! 👇`,
    ].join('\n');
    await (messageId ? editMessage(chatId, messageId, msg, MAIN_MENU) : sendMessage(chatId, msg, MAIN_MENU));
    return;
  }

  if (action === 'dashboard') {
    const report = await buildDashboard(supabase, rid, sym, tz, name);
    await respond(report, {
      inline_keyboard: [
        [
          { text: '📊 Full Sales Report', callback_data: 'sales:today' },
          { text: '📦 Stock', callback_data: 'stock:low' },
        ],
        [
          { text: '🔄 Refresh', callback_data: 'dash:overview' },
          { text: '‹ Main Menu', callback_data: 'nav:menu' },
        ],
      ],
    });
    return;
  }

  if (action === 'sales' || action === 'cashflow') {
    const report = await buildSalesReport(supabase, rid, sym, tz, range, name);
    await respond(report, {
      inline_keyboard: [
        [
          { text: '📊 Today', callback_data: 'sales:today' },
          { text: '📅 This Week', callback_data: 'sales:week' },
          { text: '📆 7 Days', callback_data: 'sales:7d' },
          { text: '📉 30 Days', callback_data: 'sales:30d' },
        ],
        [
          { text: '📦 Stock', callback_data: 'stock:low' },
          { text: '🏆 Top Products', callback_data: 'top:products' },
          { text: '‹ Menu', callback_data: 'nav:menu' },
        ],
      ],
    });
    return;
  }

  if (action === 'stock') {
    const report = await buildStockReport(supabase, rid);
    await respond(report, {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'stock:low' },
          { text: '📊 Sales', callback_data: 'sales:today' },
          { text: '‹ Menu', callback_data: 'nav:menu' },
        ],
      ],
    });
    return;
  }

  if (action === 'top_products') {
    const report = await buildTopProducts(supabase, rid, sym, tz, range, name);
    await respond(report, {
      inline_keyboard: [
        [
          { text: '📊 Today', callback_data: 'top:today' },
          { text: '📅 This Week', callback_data: 'top:week' },
          { text: '📆 30 Days', callback_data: 'top:30d' },
        ],
        [
          { text: '📦 Stock Alerts', callback_data: 'stock:low' },
          { text: '💰 Sales', callback_data: 'sales:today' },
          { text: '‹ Menu', callback_data: 'nav:menu' },
        ],
      ],
    });
    return;
  }

  if (action === 'ops') {
    const report = await buildOpsReport(supabase, rid, tz);
    await respond(report, {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: 'ops:summary' },
          { text: '📊 Sales', callback_data: 'sales:today' },
        ],
        [
          { text: '📦 Stock', callback_data: 'stock:low' },
          { text: '‹ Main Menu', callback_data: 'nav:menu' },
        ],
      ],
    });
    return;
  }

  if (action === 'settings') {
    const settingsText = [
      `⚙️ <b>Your PharmIQ Settings</b>`,
      '',
      `🏪 <b>Business:</b> ${name}`,
      `🌍 <b>Timezone:</b> ${tz}`,
      `💱 <b>Currency:</b> ${sym}`,
      '',
      `To manage notification preferences and report schedules, open your <b>PharmIQ dashboard</b>.`,
      '',
      `👇 Meanwhile, here's what I can help you with:`,
    ].join('\n');
    await respond(settingsText, MAIN_MENU);
    return;
  }
}

// ─── Main Server ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const payload = await req.json();

    // ── Callback Query (button press) ─────────────────────────────────
    if (payload.callback_query) {
      const cq = payload.callback_query;
      await answerCallback(cq.id);

      const chatId = cq.message.chat.id;
      const messageId = cq.message.message_id;
      const firstName = cq.from.first_name || 'there';
      const cbData: string = cq.data;

      // Show typing on the new message
      await sendTyping(chatId);

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, name, currency_symbol, telegram_report_timezone, telegram_enabled')
        .eq('telegram_chat_id', chatId.toString())
        .maybeSingle();

      if (!restaurant || !restaurant.telegram_enabled) {
        await editMessage(chatId, messageId, '❌ Session expired or Telegram is disabled. Please reconnect from your PharmIQ dashboard.');
        return new Response('OK');
      }

      const [prefix, param] = cbData.split(':');
      const rid = restaurant.id;
      const tz = restaurant.telegram_report_timezone || 'Africa/Lagos';
      const sym = restaurant.currency_symbol || '₦';
      const name = restaurant.name;

      let action = prefix;
      let range = 'today';

      if (prefix === 'sales') { action = 'sales'; range = param || 'today'; }
      else if (prefix === 'cashflow') { action = 'cashflow'; range = param || 'today'; }
      else if (prefix === 'top') { action = 'top_products'; range = param || 'today'; }
      else if (prefix === 'stock') action = 'stock';
      else if (prefix === 'ops') action = 'ops';
      else if (prefix === 'dash') action = 'dashboard';
      else if (prefix === 'nav') action = param;
      else if (prefix === 'info') action = param;

      await handleCommand(supabase, chatId, action, range, rid, tz, sym, name, firstName, messageId);
      return new Response('OK');
    }

    // ── Text Message ──────────────────────────────────────────────────
    if (!payload.message || !payload.message.text) return new Response('OK');

    const { text, chat, from } = payload.message;
    const chatId = chat.id;
    const firstName = from.first_name || 'there';

    // Show typing indicator immediately
    await sendTyping(chatId);

    // ── /start <token> — Connection flow ─────────────────────────────
    if (text.startsWith('/start ')) {
      const secureToken = text.split(' ')[1];
      const { data: tokenRecord, error: tokenError } = await supabase
        .from('telegram_verification_tokens')
        .select('id, restaurant_id, expires_at, used_at')
        .eq('token', secureToken)
        .maybeSingle();

      if (tokenError) throw tokenError;
      if (!tokenRecord) {
        await sendMessage(chatId, `❌ Invalid connection link.\n\nPlease go back to your PharmIQ dashboard and generate a new connection link.`);
        return new Response('OK');
      }
      if (tokenRecord.used_at) {
        await sendMessage(chatId, `❌ This link has already been used.\n\nGenerate a fresh one from your PharmIQ dashboard → Settings → Notifications.`);
        return new Response('OK');
      }
      if (new Date(tokenRecord.expires_at) < new Date()) {
        await sendMessage(chatId, `⏱ This link has expired.\n\nGenerate a new one from your PharmIQ dashboard → Settings → Notifications.`);
        return new Response('OK');
      }

      await supabase.from('telegram_verification_tokens').update({ used_at: new Date().toISOString() }).eq('id', tokenRecord.id);

      const username = from.username ? `@${from.username}` : firstName;
      const { error: updateError, data: updatedRestaurant } = await supabase
        .from('restaurants')
        .update({
          telegram_chat_id: chatId.toString(),
          telegram_username: username,
          telegram_connected_at: new Date().toISOString(),
          telegram_enabled: true,
        })
        .eq('id', tokenRecord.restaurant_id)
        .select('id, name, currency_symbol, telegram_report_timezone')
        .maybeSingle();

      if (updateError) throw updateError;

      const bizName = updatedRestaurant?.name || 'your pharmacy';
      const sym = updatedRestaurant?.currency_symbol || '₦';
      const tz = updatedRestaurant?.telegram_report_timezone || 'Africa/Lagos';

      // Show welcome + immediately send a quick dashboard
      await sendMessage(
        chatId,
        [
          `🎉 <b>Successfully Connected!</b>`,
          '',
          `Welcome, <b>${firstName}!</b> 🚀`,
          `<b>${bizName}</b> is now linked to this chat.`,
          '',
          `You'll receive automated daily reports, low-stock alerts, and can query live data anytime.`,
          '',
          `Here's your live dashboard to get started 👇`,
        ].join('\n'),
      );

      // Small pause then send dashboard
      await sendTyping(chatId);
      const rid = updatedRestaurant?.id;
      if (rid) {
        const dashReport = await buildDashboard(supabase, rid, sym, tz, bizName);
        await sendMessage(chatId, dashReport, MAIN_MENU);
      } else {
        await sendMessage(chatId, `What would you like to explore first?`, MAIN_MENU);
      }
      return new Response('OK');
    }

    // Identify linked restaurant
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id, name, currency_symbol, telegram_report_timezone, telegram_enabled')
      .eq('telegram_chat_id', chatId.toString())
      .maybeSingle();

    if (!restaurant) {
      await sendMessage(
        chatId,
        [
          `👋 Hello, <b>${firstName}!</b> I'm the <b>PharmIQ AI Assistant</b>.`,
          '',
          `It looks like your account isn't connected yet.`,
          '',
          `<b>Here's how to get started:</b>`,
          `1️⃣ Open your <b>PharmIQ dashboard</b>`,
          `2️⃣ Go to <b>Settings → Notifications</b>`,
          `3️⃣ Click <b>"Connect Telegram"</b>`,
          `4️⃣ Tap the link — you'll be connected instantly!`,
          '',
          `Once connected, you'll get real-time sales data, stock alerts, and more — right here without opening the app. 🚀`,
        ].join('\n'),
      );
      return new Response('OK');
    }

    if (!restaurant.telegram_enabled) {
      await sendMessage(chatId, `❌ Telegram is currently disabled for your account.\n\nRe-enable it from your PharmIQ dashboard → Settings → Notifications.`);
      return new Response('OK');
    }

    const rid = restaurant.id;
    const tz = restaurant.telegram_report_timezone || 'Africa/Lagos';
    const sym = restaurant.currency_symbol || '₦';
    const name = restaurant.name;

    // /start or /menu without token — show dashboard
    if (text.trim() === '/start' || text.trim() === '/menu') {
      const dashReport = await buildDashboard(supabase, rid, sym, tz, name);
      await sendMessage(chatId, dashReport, MAIN_MENU);
      return new Response('OK');
    }

    // /help — show with menu
    if (text.trim() === '/help') {
      await handleCommand(supabase, chatId, 'help', 'today', rid, tz, sym, name, firstName);
      return new Response('OK');
    }

    // Natural Language Understanding
    const intent = detectIntent(text);
    if (intent) {
      await handleCommand(supabase, chatId, intent.action, intent.range, rid, tz, sym, name, firstName);
      return new Response('OK');
    }

    // Unrecognized — friendly nudge with full menu
    await sendMessage(
      chatId,
      [
        `🤖 I didn't quite catch that — but no worries!`,
        '',
        `Try something like:`,
        `  • <i>"How are sales today?"</i>`,
        `  • <i>"Show me low stock items"</i>`,
        `  • <i>"What's my best-selling product?"</i>`,
        '',
        `Or just tap a button below 👇`,
      ].join('\n'),
      MAIN_MENU,
    );

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response('Error', { status: 500 });
  }
});
