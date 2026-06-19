import { useState, useEffect, useCallback } from 'react';
import { db, OfflineProduct } from './db';
import { useOfflineQueue } from './useOfflineQueue';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import { v4 as uuidv4 } from 'uuid';

export function useOfflinePos(restaurantId: string | undefined, userId: string | undefined) {
  const isOffline = useOfflineStatus();
  const { queueAction } = useOfflineQueue();
  const [products, setProducts] = useState<OfflineProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Load products from Dexie
  const loadLocalProducts = useCallback(async () => {
    if (!restaurantId) return;
    try {
      const localProducts = await db.products.where('restaurant_id').equals(restaurantId).toArray();
      setProducts(localProducts);
    } catch (err) {
      console.error("Failed to load local products:", err);
    } finally {
      setIsLoading(false);
    }
  }, [restaurantId]);

  // Sync products from Supabase to Dexie when online
  const syncProductsSnapshot = useCallback(async () => {
    if (!restaurantId || isOffline) return;
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      if (!data) return;

      const now = Date.now();
      const offlineProducts: OfflineProduct[] = data.map(item => ({
        id: item.id,
        restaurant_id: item.restaurant_id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        image: item.image_url, // map correctly
        available: item.available,
        track_inventory: item.track_inventory,
        stock_quantity: item.stock_quantity || 0,
        low_stock_threshold: item.low_stock_threshold || 0,
        auto_hide_out_of_stock: item.auto_hide_out_of_stock || false,
        barcode: item.barcode,
        requires_prescription: item.requires_prescription,
        last_synced_at: now
      }));

      // Update local DB
      await db.products.bulkPut(offlineProducts);
      
      // Reload UI state
      setProducts(offlineProducts);
    } catch (err) {
      console.error("Failed to sync products snapshot:", err);
    }
  }, [restaurantId, isOffline]);

  // Watch pending sync count
  useEffect(() => {
    const updateCount = async () => {
      const count = await db.syncQueue.where('status').anyOf('pending', 'failed').count();
      setPendingSyncCount(count);
    };

    updateCount();
    
    // Listen to changes in syncQueue (Dexie doesn't have live query natively without dexie-react-hooks, but we can poll or hook into events)
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  // Initial load
  useEffect(() => {
    if (!restaurantId) return;
    loadLocalProducts().then(() => {
      if (!isOffline) {
        syncProductsSnapshot();
        triggerSync(); // kick off any pending syncs
      }
    });
  }, [restaurantId, isOffline, loadLocalProducts, syncProductsSnapshot]);

  const placeOrder = async (cart: any[], paymentMethod: string, total: number, customerName?: string, cashGiven?: number, patientId?: string) => {
    if (!restaurantId || !userId) throw new Error("Missing context");

    const shortCode = Math.floor(1000 + Math.random() * 9000).toString();
    const orderId = uuidv4();
    const nowStr = new Date().toISOString();

    const salePayload = {
      id: orderId,
      restaurant_id: restaurantId,
      user_id: userId,
      short_code: shortCode,
      table_number: 'Walk-in',
      status: 'completed',
      payment_status: paymentMethod === 'cash' ? 'cash_paid' : 'pos_paid',
      total,
      created_at: nowStr,
      customer_name: customerName,
      patient_id: patientId,
      cash_given: cashGiven,
      intent: 'take-away',
      order_items: cart.map(item => ({
        menu_item_id: item.id,
        name: item.name,
        qty: item.qty,
        price: item.price,
        item_intent: item.item_intent || 'take-away',
        notes: item.notes
      }))
    };

    // 1. Queue the SALE_CREATE action
    await queueAction(restaurantId, 'SALE_CREATE', salePayload);

    // 2. Optimistically deduct local inventory
    for (const item of cart) {
      if (item.track_inventory) {
        const localProduct = await db.products.get(item.id);
        if (localProduct) {
          await db.products.update(item.id, {
            stock_quantity: localProduct.stock_quantity - item.qty
          });
        }
      }
    }

    // 3. Keep local record for history/receipts
    await db.sales.add(salePayload);
    
    // Refresh local list
    await loadLocalProducts();

    return { shortCode, orderId };
  };

  return {
    products,
    isLoading,
    isOffline,
    pendingSyncCount,
    placeOrder,
    syncProductsSnapshot
  };
}
