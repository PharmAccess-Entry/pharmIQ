import Dexie, { Table } from 'dexie';

export interface OfflineProduct {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price?: number | null;
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
  shift_id?: string | null;
  order_items: {
    menu_item_id: string;
    name: string;
    qty: number;
    price: number;
    cost_price?: number;
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
  type: 'SALE_CREATE' | 'SALE_UPDATE' | 'REFUND_CREATE' | 'STOCK_UPDATE' | 'EXPENSE_CREATE' | 'SHIFT_CREATE' | 'SHIFT_CLOSE' | 'PATIENT_CREATE' | 'PATIENT_UPDATE' | 'SUPPLIER_CREATE' | 'SUPPLIER_UPDATE' | 'PRODUCT_CREATE' | 'PRODUCT_UPDATE' | 'PRODUCT_DELETE' | 'TELEGRAM_NOTIFY' | 'CREDIT_TRANSACTION_CREATE' | 'RETURN_CREATE';
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

export interface OfflinePatient {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string;
  allergies: string[];
  chronic_conditions: string[];
  last_visit?: string | null;
  credit_limit?: number;
  balance_due?: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineCustomerTransaction {
  id: string;
  restaurant_id: string;
  patient_id: string;
  amount: number;
  transaction_type: string;
  order_id?: string | null;
  created_by?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface OfflineReturn {
  id: string;
  restaurant_id: string;
  order_id: string;
  staff_id?: string | null;
  shift_id?: string | null;
  refund_method: string;
  total_refunded: number;
  reason: string;
  created_at: string;
}

export interface OfflineReturnItem {
  id: string;
  return_id: string;
  order_item_id: string;
  menu_item_id: string;
  qty: number;
  returned_to_stock: boolean;
}

export interface OfflineSupplier {
  id: string;
  restaurant_id: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineExpense {
  id: string;
  restaurant_id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface OfflineShift {
  id: string;
  restaurant_id: string;
  user_id: string;
  status: string;
  start_time: string;
  end_time?: string | null;
  start_cash: number;
  expected_cash?: number | null;
  actual_cash?: number | null;
  expected_pos?: number | null;
  actual_pos?: number | null;
  expected_transfers?: number | null;
  actual_transfers?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OfflineInventory {
  id: string;
  restaurant_id: string;
  menu_item_id: string;
  change_qty: number;
  reason: string;
  created_at: string;
  movement_type?: string | null;
  quantity_before?: number | null;
  quantity_after?: number | null;
  reference_type?: string | null;
  reference_id?: string | null;
  user_id?: string | null;
  source?: string | null;
  note?: string | null;
  shift_id?: string | null;
  created_by?: string | null;
}


export class PharmIQOfflineDB extends Dexie {
  products!: Table<OfflineProduct, string>;
  sales!: Table<OfflineSale, string>;
  offline_queue!: Table<OfflineAction, string>;
  print_queue!: Table<PrintJob, string>;
  receipts!: Table<OfflineReceipt, string>;
  patients!: Table<OfflinePatient, string>;
  suppliers!: Table<OfflineSupplier, string>;
  expenses!: Table<OfflineExpense, string>;
  shifts!: Table<OfflineShift, string>;
  inventory!: Table<OfflineInventory, string>;
  customer_transactions!: Table<OfflineCustomerTransaction, string>;
  returns!: Table<OfflineReturn, string>;
  return_items!: Table<OfflineReturnItem, string>;

  constructor() {
    super('PharmIQOfflineDB');
    this.version(4).stores({
      products: 'id, restaurant_id, category, barcode, name',
      sales: 'id, restaurant_id, created_at, status',
      offline_queue: 'id, restaurant_id, type, status, created_at',
      print_queue: 'id, restaurant_id, job_type, status, created_at',
      receipts: 'id, restaurant_id, short_code',
      patients: 'id, restaurant_id, name, phone',
      suppliers: 'id, restaurant_id, name',
      expenses: 'id, restaurant_id, date, category',
      shifts: 'id, restaurant_id, user_id, status, start_time',
      inventory: 'id, restaurant_id, menu_item_id, created_at',
      customer_transactions: 'id, restaurant_id, patient_id, transaction_type, created_at',
      returns: 'id, restaurant_id, order_id, refund_method, created_at',
      return_items: 'id, return_id, order_item_id, menu_item_id'
    });
  }
}

export const db = new PharmIQOfflineDB();
