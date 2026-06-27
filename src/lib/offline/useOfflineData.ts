/**
 * useOfflineData — Central offline data snapshot manager.
 *
 * When online: fetches data from Supabase and writes a snapshot into Dexie.
 * When offline: reads from the Dexie snapshot.
 *
 * This hook is used by Patients, Suppliers, Expenses, Shifts,
 * Inventory, and MenuManagement so they all work for 8 hours offline.
 */
import { useEffect, useState, useCallback } from 'react';
import { db, OfflinePatient, OfflineSupplier, OfflineExpense, OfflineShift, OfflineInventory, OfflineProduct } from './db';
import { supabase } from '@/integrations/supabase/client';

// ────────────────────────────────────────────────────────────────────────────
// Generic helper — writes a full Supabase result set into a Dexie table
// ────────────────────────────────────────────────────────────────────────────
async function snapshot<T extends { id: string }>(
  table: any,
  restaurantId: string,
  rows: T[]
): Promise<void> {
  // Delete old records for this restaurant and bulk insert the fresh set
  await table.where('restaurant_id').equals(restaurantId).delete();
  if (rows.length > 0) await table.bulkPut(rows);
}

// ────────────────────────────────────────────────────────────────────────────
// Patients
// ────────────────────────────────────────────────────────────────────────────
export function useOfflinePatients(restaurantId: string | undefined) {
  const [patients, setPatients] = useState<OfflinePatient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    if (navigator.onLine) {
      const { data } = await supabase
        .from('patients')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');
      if (data) {
        const rows = data as OfflinePatient[];
        await snapshot(db.patients, restaurantId, rows);
        setPatients(rows);
      }
    } else {
      const rows = await db.patients.where('restaurant_id').equals(restaurantId).sortBy('name');
      setPatients(rows);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  // Reload from Dexie when sync completes while offline
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('pharmiq_sync_complete', handler);
    return () => window.removeEventListener('pharmiq_sync_complete', handler);
  }, [load]);

  return { patients, setPatients, loading, reload: load };
}

// ────────────────────────────────────────────────────────────────────────────
// Suppliers
// ────────────────────────────────────────────────────────────────────────────
export function useOfflineSuppliers(restaurantId: string | undefined) {
  const [suppliers, setSuppliers] = useState<OfflineSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    if (navigator.onLine) {
      const { data } = await supabase
        .from('suppliers')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name');
      if (data) {
        const rows = data as OfflineSupplier[];
        await snapshot(db.suppliers, restaurantId, rows);
        setSuppliers(rows);
      }
    } else {
      const rows = await db.suppliers.where('restaurant_id').equals(restaurantId).sortBy('name');
      setSuppliers(rows);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('pharmiq_sync_complete', handler);
    return () => window.removeEventListener('pharmiq_sync_complete', handler);
  }, [load]);

  return { suppliers, setSuppliers, loading, reload: load };
}

// ────────────────────────────────────────────────────────────────────────────
// Expenses
// ────────────────────────────────────────────────────────────────────────────
export function useOfflineExpenses(restaurantId: string | undefined) {
  const [expenses, setExpenses] = useState<OfflineExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    if (navigator.onLine) {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('date', { ascending: false });
      if (data) {
        // Map expense_date → date if needed
        const rows = (data as any[]).map(e => ({
          ...e,
          date: e.date || e.expense_date || e.created_at?.split('T')[0],
        })) as OfflineExpense[];
        await snapshot(db.expenses, restaurantId, rows);
        setExpenses(rows);
      }
    } else {
      const rows = await db.expenses
        .where('restaurant_id').equals(restaurantId)
        .reverse()
        .sortBy('date');
      setExpenses(rows);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('pharmiq_sync_complete', handler);
    return () => window.removeEventListener('pharmiq_sync_complete', handler);
  }, [load]);

  return { expenses, setExpenses, loading, reload: load };
}

// ────────────────────────────────────────────────────────────────────────────
// Shifts
// ────────────────────────────────────────────────────────────────────────────
export function useOfflineShifts(restaurantId: string | undefined) {
  const [shifts, setShifts] = useState<OfflineShift[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    if (navigator.onLine) {
      const { data } = await supabase
        .from('shifts')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('start_time', { ascending: false })
        .limit(100);
      if (data) {
        const rows = data as OfflineShift[];
        await snapshot(db.shifts, restaurantId, rows);
        setShifts(rows);
      }
    } else {
      const rows = await db.shifts.where('restaurant_id').equals(restaurantId).reverse().sortBy('start_time');
      setShifts(rows);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('pharmiq_sync_complete', handler);
    return () => window.removeEventListener('pharmiq_sync_complete', handler);
  }, [load]);

  return { shifts, setShifts, loading, reload: load };
}

// ────────────────────────────────────────────────────────────────────────────
// Inventory Logs
// ────────────────────────────────────────────────────────────────────────────
export function useOfflineInventoryLogs(restaurantId: string | undefined) {
  const [logs, setLogs] = useState<OfflineInventory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    if (navigator.onLine) {
      const { data } = await supabase
        .from('inventory_logs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (data) {
        const rows = data as OfflineInventory[];
        await snapshot(db.inventory, restaurantId, rows);
        setLogs(rows);
      }
    } else {
      const rows = await db.inventory.where('restaurant_id').equals(restaurantId).reverse().sortBy('created_at');
      setLogs(rows);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('pharmiq_sync_complete', handler);
    return () => window.removeEventListener('pharmiq_sync_complete', handler);
  }, [load]);

  return { logs, loading, reload: load };
}

// ────────────────────────────────────────────────────────────────────────────
// Products (for MenuManagement read-only offline)
// ────────────────────────────────────────────────────────────────────────────
export function useOfflineProducts(restaurantId: string | undefined) {
  const [products, setProducts] = useState<OfflineProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    if (navigator.onLine) {
      const { data } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('category');
      if (data) {
        const rows = (data as any[]).map(item => ({
          ...item,
          last_synced_at: Date.now(),
        })) as OfflineProduct[];
        // bulkPut merges — products table already has the POS using it
        await db.products.bulkPut(rows);
        setProducts(rows);
      }
    } else {
      const rows = await db.products.where('restaurant_id').equals(restaurantId).sortBy('category');
      setProducts(rows);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('pharmiq_sync_complete', handler);
    return () => window.removeEventListener('pharmiq_sync_complete', handler);
  }, [load]);

  return { products, setProducts, loading, reload: load };
}
