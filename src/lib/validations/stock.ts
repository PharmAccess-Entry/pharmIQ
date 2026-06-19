import { OfflineProduct } from '../offline/db';

export interface CartItem extends OfflineProduct {
  cartItemId: string;
  qty: number;
  item_intent?: string;
  notes?: string;
}

export function validateStockChange(cart: CartItem[], patientId?: string | null): { valid: boolean; error?: string } {
  for (const item of cart) {
    if (item.qty <= 0) continue;

    // Validation A: Stock Check
    if (item.track_inventory && item.stock_quantity < item.qty) {
      return {
        valid: false,
        error: `Insufficient stock for ${item.name} (Requested: ${item.qty}, Available: ${item.stock_quantity})`
      };
    }

    // Validation B: Prescription Check
    if (item.requires_prescription && (!patientId || patientId.trim() === '')) {
      return {
        valid: false,
        error: `Prescription required for ${item.name} but no patient was selected.`
      };
    }

    // Validation C: Expiry Check (future proofing if expiry_date is exposed to frontend)
    // if (item.expiry_date && new Date(item.expiry_date) < new Date()) {
    //   return { valid: false, error: `Cannot sell expired drug: ${item.name}` };
    // }
  }

  return { valid: true };
}
