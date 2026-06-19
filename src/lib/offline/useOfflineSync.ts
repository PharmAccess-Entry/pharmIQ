import { useEffect, useState, useRef } from 'react';
import { db } from './db';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const calculateBackoff = (attempts: number) => {
    // Exponential backoff: 2s, 4s, 8s, 16s... max 60s
    return Math.min(Math.pow(2, attempts) * 1000, 60000);
  };

  const processSync = async () => {
    if (isSyncing || !navigator.onLine) return;
    
    const pendingItems = await db.offline_queue
      .where('status')
      .anyOf('pending', 'failed')
      .toArray();

    if (pendingItems.length === 0) {
      setQueueSize(0);
      return;
    }

    setIsSyncing(true);
    setQueueSize(pendingItems.length);

    // Sort by created_at ascending to maintain chronological order
    pendingItems.sort((a, b) => a.created_at - b.created_at);

    let anySuccess = false;

    for (const item of pendingItems) {
      await db.offline_queue.update(item.id, { status: 'syncing', attempts: item.attempts + 1 });

      try {
        if (item.type === 'SALE_CREATE') {
          // Destructure payload to match RPC args
          const p = item.payload;
          
          const { error } = await supabase.rpc('process_pharmacy_sale', {
            p_restaurant_id: p.restaurant_id,
            p_user_id: p.user_id,
            p_short_code: p.short_code,
            p_table_number: p.table_number,
            p_status: p.status,
            p_payment_status: p.payment_status,
            p_total: p.total,
            p_customer_name: p.customer_name,
            p_patient_id: p.patient_id,
            p_cash_given: p.cash_given,
            p_intent: p.intent,
            p_items: p.order_items // array of pharmacy_order_item
          });
          
          if (error) throw error;
        } 
        else if (item.type === 'EXPENSE_CREATE') {
            const { error } = await supabase.from('expenses').insert(item.payload);
            if (error) throw error;
        }
        else if (item.type === 'REFUND_CREATE') {
           // handled via RPC or existing mechanism
        }

        // Successfully synced, remove from queue
        await db.offline_queue.delete(item.id);
        anySuccess = true;
      } catch (err: any) {
        console.error(`[Offline Sync] Failed for item ${item.id}:`, err);
        await db.offline_queue.update(item.id, { 
          status: 'failed', 
          error_message: err.message || 'Unknown error'
        });
        
        // Stop current batch if we hit a failure to preserve order and retry later
        break; 
      }
    }

    setIsSyncing(false);
    setLastSyncTime(Date.now());
    
    const remaining = await db.offline_queue.where('status').anyOf('pending', 'failed').count();
    setQueueSize(remaining);

    if (remaining > 0) {
      // Schedule a retry with exponential backoff based on the first failed item
      const firstFailed = await db.offline_queue.where('status').equals('failed').first();
      if (firstFailed) {
        const delay = calculateBackoff(firstFailed.attempts);
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
          processSync();
        }, delay);
      }
    } else if (anySuccess) {
        toast.success("Offline data synced successfully");
        // Refetch state logic can be hooked into custom events
        window.dispatchEvent(new CustomEvent('pharmiq_sync_complete'));
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSync();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You are offline. Operating in offline mode.");
    };

    const handleActionQueued = () => {
      if (navigator.onLine) {
        processSync();
      } else {
        db.offline_queue.where('status').anyOf('pending', 'failed').count().then(setQueueSize);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pharmiq_offline_action_queued', handleActionQueued);

    // Initial check
    db.offline_queue.where('status').anyOf('pending', 'failed').count().then(setQueueSize);
    if (navigator.onLine) processSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pharmiq_offline_action_queued', handleActionQueued);
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, []);

  return {
    isOnline,
    isSyncing,
    queueSize,
    lastSyncTime,
    triggerSync: processSync
  };
};
