import { supabase } from "@/integrations/supabase/client";
import { mockMenu } from "@/lib/mockData";

/**
 * Seeds a full realistic dataset into the restaurant's Supabase tables.
 * Safe to re-run: skips menu if items already exist.
 * Inserts fresh orders/notifications every time (use for demos).
 */
export async function seedTestData(restaurantId: string): Promise<{ ok: boolean; message: string }> {
  try {
    // 1. Fill in bank details + table count on the restaurant profile
    await supabase
      .from("restaurants")
      .update({
        phone: "+234 801 234 5678",
        table_count: 8,
        bank_name: "Guaranty Trust Bank",
        bank_account_number: "0123456789",
        bank_account_name: "Mama Cass Ventures Ltd",
      })
      .eq("id", restaurantId);

    // 2. Seed menu items (only if empty)
    const { data: existingItems } = await supabase
      .from("menu_items")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .limit(1);

    let menuIds: Record<string, string> = {};

    if (!existingItems || existingItems.length === 0) {
      const rows = mockMenu.map((m) => ({
        restaurant_id: restaurantId,
        name: m.name,
        description: m.description,
        price: m.price,
        category: m.category,
        image: m.image,
        available: m.available,
      }));
      const { data: inserted } = await supabase.from("menu_items").insert(rows).select("id, name");
      (inserted || []).forEach((i: any) => { menuIds[i.name] = i.id; });
    } else {
      // Fetch existing ids for mapping
      const { data: items } = await supabase
        .from("menu_items")
        .select("id, name")
        .eq("restaurant_id", restaurantId);
      (items || []).forEach((i: any) => { menuIds[i.name] = i.id; });
    }

    // 3. Seed 10 realistic orders with varied statuses
    const now = Date.now();
    const seedOrders = [
      {
        short_code: `ORD-${7001}`, table_number: "5", intent: "dine-in", status: "pending",
        total: 7000, customer_name: "Emeka Obi",
        items: [
          { name: "Jollof Rice", qty: 2, price: 2500 },
          { name: "Grilled Chicken", qty: 2, price: 2500 },
        ],
        minsAgo: 2,
      },
      {
        short_code: `ORD-${7002}`, table_number: "12", intent: "takeaway", status: "preparing",
        total: 5300, customer_name: "Ngozi Eze",
        items: [
          { name: "Pounded Yam", qty: 1, price: 1800 },
          { name: "Egusi Soup", qty: 1, price: 3500 },
        ],
        minsAgo: 8,
      },
      {
        short_code: `ORD-${7003}`, table_number: "3", intent: "mixed", status: "awaiting_payment",
        total: 7000, customer_name: "Taiwo Adeyemi",
        items: [
          { name: "Suya Platter", qty: 1, price: 3500 },
          { name: "Chapman", qty: 2, price: 1500 },
          { name: "Zobo Drink", qty: 1, price: 1000 },
        ],
        minsAgo: 18,
      },
      {
        short_code: `ORD-${7004}`, table_number: "7", intent: "dine-in", status: "paid",
        total: 6000, customer_name: "Chidinma Okafor",
        items: [
          { name: "Pepper Soup (Catfish)", qty: 1, price: 6000 },
        ],
        minsAgo: 25,
        payment_status: "confirmed",
      },
      {
        short_code: `ORD-${7005}`, table_number: "2", intent: "takeaway", status: "served",
        total: 3600, customer_name: "Bello Mohammed",
        items: [
          { name: "Puff Puff (6 pcs)", qty: 3, price: 1200 },
        ],
        minsAgo: 45,
        payment_status: "confirmed",
      },
      {
        short_code: `ORD-${7006}`, table_number: "1", intent: "dine-in", status: "pending",
        total: 8800, customer_name: "Adaora Nwosu",
        items: [
          { name: "Fried Rice", qty: 2, price: 2800 },
          { name: "Fried Turkey", qty: 1, price: 3000 },
          { name: "Bottled Water", qty: 2, price: 300 },
        ],
        minsAgo: 1,
      },
      {
        short_code: `ORD-${7007}`, table_number: "6", intent: "dine-in", status: "preparing",
        total: 12500, customer_name: "Seun Adesanya",
        items: [
          { name: "Ofada Rice & Ayamase", qty: 2, price: 3500 },
          { name: "Beef", qty: 3, price: 1800 },
        ],
        minsAgo: 12,
      },
      {
        short_code: `ORD-${7008}`, table_number: "4", intent: "dine-in", status: "served",
        total: 9500, customer_name: "Funke Alabi",
        items: [
          { name: "Amala", qty: 2, price: 1000 },
          { name: "Ewedu Soup", qty: 2, price: 3000 },
          { name: "Chilled Malt", qty: 3, price: 800 },
        ],
        minsAgo: 55,
        payment_status: "confirmed",
      },
      {
        short_code: `ORD-${7009}`, table_number: "8", intent: "dine-in", status: "pending",
        total: 4500, customer_name: "Ikenna Chukwu",
        items: [
          { name: "White Rice & Stew", qty: 1, price: 2200 },
          { name: "Plantain (Dodo)", qty: 1, price: 1000 },
          { name: "Bottled Water", qty: 1, price: 300 },
        ],
        minsAgo: 0,
      },
      {
        short_code: `ORD-${7010}`, table_number: "3", intent: "takeaway", status: "awaiting_payment",
        total: 6800, customer_name: "Amaka Igwe",
        items: [
          { name: "Shawarma (Beef)", qty: 2, price: 2800 },
          { name: "Chapman", qty: 1, price: 1500 },
        ],
        minsAgo: 22,
      },
    ];

    for (const o of seedOrders) {
      const createdAt = new Date(now - o.minsAgo * 60 * 1000).toISOString();
      const { data: order } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId,
          short_code: o.short_code,
          table_number: o.table_number,
          intent: o.intent,
          status: o.status,
          total: o.total,
          customer_name: o.customer_name,
          payment_status: (o as any).payment_status || "unpaid",
          acknowledged: o.status !== "pending",
          created_at: createdAt,
          updated_at: createdAt,
        })
        .select("id")
        .single();

      if (order?.id) {
        const itemRows = o.items.map((i) => ({
          order_id: order.id,
          menu_item_id: menuIds[i.name] || null,
          name: i.name,
          qty: i.qty,
          price: i.price,
        }));
        await supabase.from("order_items").insert(itemRows);
      }
    }

    // 4. Seed notifications
    const notifications = [
      { type: "order", title: "New order · Table 9", body: "2× Jollof Rice, 1× Grilled Chicken", link: "/dashboard/orders" },
      { type: "order", title: "New order · Table 2", body: "3× Puff Puff (6 pcs)", link: "/dashboard/orders" },
      { type: "waiter", title: "Waiter requested · Table 6", body: "Customer requested a waiter", link: "/dashboard/orders" },
      { type: "payment", title: "Payment uploaded · Table 3", body: "Customer sent a payment screenshot — please confirm.", link: "/dashboard/orders" },
      { type: "system", title: "Sample data loaded 🎉", body: "This is test data. Your real orders will appear here once customers scan QR codes.", link: "/dashboard" },
    ];
    await supabase.from("notifications").insert(
      notifications.map((n) => ({ restaurant_id: restaurantId, ...n }))
    );

    return { ok: true, message: `Seeded ${seedOrders.length} orders, ${mockMenu.length} menu items, and ${notifications.length} notifications.` };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Seed failed" };
  }
}
