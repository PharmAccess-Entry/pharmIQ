import { db, OfflineAction } from './db';
import { v4 as uuidv4 } from 'uuid';

export const useOfflineQueue = () => {
  const queueAction = async (restaurant_id: string, type: OfflineAction['type'], payload: any) => {
    const action: OfflineAction = {
      id: uuidv4(),
      restaurant_id,
      type,
      payload,
      status: 'pending',
      attempts: 0,
      created_at: Date.now()
    };
    
    await db.offline_queue.add(action);
    
    // Dispatch a custom event to notify the sync engine immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pharmiq_offline_action_queued'));
    }
    
    return action.id;
  };

  return { queueAction };
};
