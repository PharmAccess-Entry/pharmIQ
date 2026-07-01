import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const BOT_TOKEN = "8890384452:AAEkKSGm4U-s9b6qGON9QqikvjoQrcI17FI";
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, currency_symbol, telegram_chat_id, telegram_enabled, telegram_report_time, telegram_report_timezone, telegram_notify_prefs')
      .eq('telegram_enabled', true)
      .not('telegram_chat_id', 'is', null);

    if (error) throw error;

    const now = new Date();
    let sentCount = 0;

    for (const r of restaurants || []) {
      const tz = r.telegram_report_timezone || 'Africa/Lagos';
      const timeStr = r.telegram_report_time || '22:00:00'; 
      
      const targetHour = parseInt(timeStr.split(':')[0]);
      
      // Get the current hour in the target timezone accurately (0-23)
      const dateInTz = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const currentHour = dateInTz.getHours();

      if (currentHour === targetHour) {
         const prefs = r.telegram_notify_prefs as Record<string, boolean>;
         if (prefs && prefs['daily_report'] === false) continue;

         const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
         // Build precise localized ISO bounds for the start/end of day
         const start = new Date(`${ymd}T00:00:00${getTimezoneOffsetString(tz, now)}`).toISOString();
         const end = new Date(`${ymd}T23:59:59.999${getTimezoneOffsetString(tz, now)}`).toISOString();

         const result = await fetchAnalytics(supabase, r.id, start, end);
         const totalExp = await fetchExpenses(supabase, r.id, start, end);
         const netProfit = result.grossProfit - totalExp;
         const aov = result.txCount > 0 ? result.revenue / result.txCount : 0;
         const sym = r.currency_symbol || '₦';

         const text = [
          `📊 <b>Daily Automated Report — ${r.name}</b>`,
          `📅 ${formatDate(ymd)}`,
          '',
          `💰 <b>Revenue:</b> ${sym}${fmt(result.revenue)}`,
          `📦 <b>COGS:</b> ${sym}${fmt(result.cogs)}`,
          `📉 <b>Expenses:</b> ${sym}${fmt(totalExp)}`,
          `📈 <b>Net Profit:</b> ${sym}${fmt(netProfit)}`,
          '',
          `🧾 <b>Orders:</b> ${result.txCount}`,
          `💳 <b>Avg Order Value:</b> ${sym}${fmt(aov)}`,
          '',
          `<b>💵 Cash Flow Breakdown:</b>`,
          `• Cash: ${sym}${fmt(result.cash)}`,
          `• POS: ${sym}${fmt(result.pos)}`,
          `• Transfers: ${sym}${fmt(result.transfer)}`,
         ].join('\n');

         await sendMessage(r.telegram_chat_id, text);
         sentCount++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: sentCount }), { headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('Cron error:', err.message || err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

function getTimezoneOffsetString(tz: string, date: Date) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const parts = dtf.formatToParts(date);
    const tzName = parts.find(p => p.type === 'timeZoneName')?.value;
    if (!tzName || tzName === 'GMT') return 'Z';
    return tzName.replace('GMT', '');
  } catch {
    return '+01:00'; // fallback
  }
}

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
      if (!(item.cost_price > 0) && item.menu_item_id) {
        missingCostIds.add(item.menu_item_id);
      }
    });
  });

  const costMap: Record<string, number> = {};
  if (missingCostIds.size > 0) {
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, cost_price')
      .in('id', Array.from(missingCostIds));
    (menuItems || []).forEach((m: any) => { costMap[m.id] = Number(m.cost_price) || 0; });
  }

  let revenue = 0, cash = 0, pos = 0, transfer = 0, cogs = 0;

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
  });

  return { revenue, cash, pos, transfer, cogs, grossProfit: revenue - cogs, txCount: orders.length };
}

async function fetchExpenses(supabase: any, rid: string, start: string, end: string) {
  const dateStart = start.split('T')[0];
  const dateEnd = end.split('T')[0];
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('restaurant_id', rid)
    .gte('expense_date', dateStart)
    .lte('expense_date', dateEnd);
  return (expenses || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
}

function fmt(n: number) { return n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(ymd: string) { return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }

async function sendMessage(chatId: string, text: string) {
  await fetch(`${API}/sendMessage`, { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }) 
  });
}
