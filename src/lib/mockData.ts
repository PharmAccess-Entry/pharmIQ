export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  available: boolean;
  /** IDs of items commonly bought together — drives the "Goes well with" impulse buy strip */
  pairsWith?: string[];
  barcode?: string;
  expiry_date?: string;
  batch_number?: string;
  requires_prescription?: boolean;
};

export type OrderStatus = "Pending" | "Preparing" | "Served";
export type OrderIntent = "dine-in" | "takeaway" | "mixed";
export type ItemIntent = "eat-here" | "take-away";

export type Order = {
  id: string;
  table: number;
  items: { name: string; qty: number; price: number; itemIntent?: ItemIntent }[];
  status: OrderStatus;
  intent: OrderIntent;
  total: number;
  placedAt: string;
  urgent?: boolean;
  patient_id?: string;
};

export type Patient = {
  id: string;
  name: string;
  phone: string;
  allergies: string[];
  chronic_conditions: string[];
  last_visit?: string;
};

/**
 * Default categories for a Nigerian restaurant. Restaurant owners can
 * add/rename/remove these from the dashboard's Category manager.
 */
export const defaultCategories = [
  "Antimalarials",
  "Analgesics & Pain Relief",
  "Antibiotics & Antibacterials",
  "Antihypertensives (Blood Pressure)",
  "Antidiabetics (Blood Sugar)",
  "Cardiovascular",
  "Cough, Cold & Allergies",
  "Vitamins & Supplements",
  "Gastrointestinal & Antacids",
  "Dermatological & Topical",
  "Paediatrics",
  "Eye, Ear & Nasal",
  "Antifungals",
  "Antiparasitics & Dewormers",
  "Hormones, Contraceptives & Men's Health",
  "Mental Health & Neurology",
  "Anti-HIV (ARVs)",
  "Urinary Tract",
  "First Aid, Consumables & Others"
];

export const mockMenu: MenuItem[] = [
  // Antibiotics
  { id: "1", name: "Amoxicillin 500mg", description: "Broad-spectrum penicillin antibiotic — capsules", price: 1500, category: "Antibiotics", image: "", available: true, pairsWith: ["v1", "v2"] },
  { id: "2", name: "Ciprofloxacin 500mg", description: "Fluoroquinolone broad-spectrum antibiotic", price: 2200, category: "Antibiotics", image: "", available: true, pairsWith: ["v1"] },
  { id: "3", name: "Azithromycin 500mg", description: "Macrolide antibiotic — 3-day course", price: 3500, category: "Antibiotics", image: "", available: true, pairsWith: ["v1", "v3"] },

  // Analgesics & Pain Relief
  { id: "10", name: "Paracetamol 500mg", description: "Standard paracetamol tablet — fever & mild pain", price: 500, category: "Analgesics & Pain Relief", image: "", available: true, pairsWith: ["v1"] },
  { id: "11", name: "Ibuprofen 400mg", description: "NSAID — standard adult pain relief", price: 800, category: "Analgesics & Pain Relief", image: "", available: true, pairsWith: [] },
  { id: "12", name: "Diclofenac 50mg", description: "Voltaren — anti-inflammatory pain relief", price: 1200, category: "Analgesics & Pain Relief", image: "", available: true, pairsWith: [] },

  // Antimalarials
  { id: "20", name: "Artemether + Lumefantrine 80/480mg", description: "Coartem adult 6-tab pack", price: 2500, category: "Antimalarials", image: "", available: true, pairsWith: ["10", "v1"] },

  // Vitamins & Supplements
  { id: "v1", name: "Vitamin C 1000mg", description: "Effervescent or tablet — high-dose", price: 1500, category: "Vitamins & Supplements", image: "", available: true, pairsWith: [] },
  { id: "v2", name: "Multivitamin Tablet", description: "Daily multivitamin & mineral supplement", price: 2000, category: "Vitamins & Supplements", image: "", available: true, pairsWith: [] },
  { id: "v3", name: "Zinc Sulfate 20mg", description: "Zinc supplement — immunity & wound healing", price: 1200, category: "Vitamins & Supplements", image: "", available: true, pairsWith: [] },
];

export const mockOrders: Order[] = [
  { id: "ORD-1042", table: 0, intent: "takeaway", items: [{ name: "Amoxicillin 500mg", qty: 1, price: 1500 }, { name: "Vitamin C 1000mg", qty: 1, price: 1500 }], status: "Pending", total: 3000, placedAt: "2 min ago", urgent: true },
  { id: "ORD-1041", table: 0, intent: "takeaway", items: [{ name: "Paracetamol 500mg", qty: 2, price: 500 }, { name: "Artemether + Lumefantrine 80/480mg", qty: 1, price: 2500 }], status: "Preparing", total: 3500, placedAt: "8 min ago" },
  { id: "ORD-1040", table: 0, intent: "takeaway", items: [{ name: "Ibuprofen 400mg", qty: 1, price: 800 }], status: "Served", total: 800, placedAt: "14 min ago" },
];

export const plans = [
  { id: "starter", name: "Starter", price: 10000, tableLimit: "5 tables", features: ["QR menu for 5 tables", "Order management", "Email support", "Basic analytics"], popular: false },
  { id: "growth", name: "Growth", price: 20000, tableLimit: "10 tables", features: ["QR menu for 10 tables", "Staff accounts", "Priority support", "Advanced analytics", "Custom branding"], popular: true },
  { id: "pro", name: "Pro", price: 50000, tableLimit: "25 tables", features: ["Unlimited tables", "Unlimited staff", "24/7 support", "Full analytics suite", "WhatsApp alerts", "API access"], popular: false },
];

export const formatNaira = (n: number) => `₦${n.toLocaleString("en-NG")}`;
