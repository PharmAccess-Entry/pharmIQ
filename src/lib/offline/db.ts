import Dexie, { Table } from 'dexie';

export interface OfflineProduct {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image: string | null;
  available: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  auto_hide_out_of_stock: boolean;
  barcode?: string | null;
  requires_prescription?: boolean | null;
  last_synced_at: number;
}

export interface OfflineSale {
  id: string;
  restaurant_id: string;
  user_id: string;
  short_code: string;
  table_number: string;
  status: string;
  payment_status: string;
  total: number;
  created_at: string;
  order_items: {
    menu_item_id: string;
    name: string;
    qty: number;
    price: number;
    item_intent: string;
    notes?: string;
  }[];
  customer_name?: string | null;
  patient_id?: string | null;
  cash_given?: number;
  intent?: string;
}

export interface OfflineAction {
  id: string; // uuid
  restaurant_id: string;
  type: 'SALE_CREATE' | 'REFUND_CREATE' | 'STOCK_UPDATE' | 'EXPENSE_CREATE';
  payload: any;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  attempts: number;
  error_message?: string;
  created_at: number;
}

export interface PrintJob {
  id: string;
  restaurant_id: string;
  job_type: 'RECEIPT' | 'STOCK' | 'REPORT';
  payload: any;
  status: 'pending' | 'printed' | 'failed';
  created_at: number;
  attempts: number;
}

export interface OfflineReceipt {
  id: string;
  restaurant_id: string;
  short_code: string;
  html_content: string;
  created_at: number;
}

export class PharmIQOfflineDB extends Dexie {
  products!: Table<OfflineProduct, string>;
  sales!: Table<OfflineSale, string>;
  offline_queue!: Table<OfflineAction, string>;
  print_queue!: Table<PrintJob, string>;
  receipts!: Table<OfflineReceipt, string>;

  constructor() {
    super('PharmIQOfflineDB');
    this.version(2).stores({
      products: 'id, restaurant_id, category, barcode, name',
      sales: 'id, restaurant_id, created_at, status',
      offline_queue: 'id, restaurant_id, type, status, created_at',
      print_queue: 'id, restaurant_id, job_type, status, created_at',
      receipts: 'id, restaurant_id, short_code'
    });
  }
}

export const db = new PharmIQOfflineDB();
