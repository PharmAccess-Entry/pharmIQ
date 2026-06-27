import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportViewer } from "@/components/reports/ReportViewer";
import { ReportConfig } from "@/lib/reports/export";
import { PrintBarcodeLabels, BarcodeLabelProps } from "@/components/reports/BarcodeLabels";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { format } from "date-fns";
import { FileText, Tags, Printer, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineStatus } from "@/lib/useOfflineStatus";

export default function Reports() {
  const { restaurant } = useRestaurant();
  const [activeTab, setActiveTab] = useState("stock_count");
  const isOffline = useOfflineStatus();
  
  // Data states
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  
  useEffect(() => {
    if (!restaurant?.id) return;
    
    // Fetch inventory for Stock Count Sheet and Valuation
    const fetchInventory = async () => {
      if (navigator.onLine) {
        const { data } = await supabase
          .from("menu_items")
          .select("id, name, barcode, category, price, stock_quantity, track_inventory")
          .eq("restaurant_id", restaurant.id)
          .eq("track_inventory", true)
          .order("name");
        
        setInventoryData(data || []);
      } else {
        const { db } = await import("@/lib/offline/db");
        const rows = await db.products.where("restaurant_id").equals(restaurant.id).filter(r => !!r.track_inventory).sortBy("name");
        setInventoryData(rows as any[]);
      }
    };
    
    fetchInventory();
  }, [restaurant?.id]);

  const stockCountConfig: ReportConfig<any> = {
    title: "Stock Count Sheet",
    subtitle: `Location: ${restaurant?.name} | Date: ${format(new Date(), "MMM dd, yyyy")}`,
    filename: "stock_count_sheet",
    columns: [
      { header: "Product Name", accessorKey: "name" },
      { header: "Category", accessorKey: "category" },
      { header: "Barcode", accessorKey: "barcode" },
      { header: "System Qty", accessorKey: "stock_quantity" },
      { header: "Physical Count", cell: () => "____________" },
      { header: "Variance", cell: () => "____________" },
      { header: "Notes", cell: () => "____________" }
    ],
    data: inventoryData
  };

  const inventoryValuationConfig: ReportConfig<any> = {
    title: "Inventory Valuation Report",
    subtitle: `Location: ${restaurant?.name} | Date: ${format(new Date(), "MMM dd, yyyy")}`,
    filename: "inventory_valuation",
    columns: [
      { header: "Product Name", accessorKey: "name" },
      { header: "Category", accessorKey: "category" },
      { header: "Current Qty", accessorKey: "stock_quantity" },
      { header: "Selling Price", cell: (r) => `₦${Number(r.price).toLocaleString()}` },
      { header: "Total Value", cell: (r) => `₦${(Number(r.price) * Number(r.stock_quantity)).toLocaleString()}` }
    ],
    data: inventoryData
  };

  const barcodeItems: BarcodeLabelProps[] = inventoryData
    .filter(i => i.barcode)
    .map(i => ({ barcode: i.barcode, name: i.name, price: i.price }));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 print:m-0 print:p-0">
        {isOffline && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm font-medium no-print">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You're offline — viewing cached reports.</span>
          </div>
        )}
        <div className="no-print">
          <h1 className="text-2xl font-bold tracking-tight">Reports & Documents</h1>
          <p className="text-muted-foreground">Generate, print, and export system reports.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="no-print">
          <TabsList className="mb-4 flex flex-wrap h-auto">
            <TabsTrigger value="stock_count" className="gap-2"><FileText className="h-4 w-4" /> Stock Count Sheet</TabsTrigger>
            <TabsTrigger value="valuation" className="gap-2"><FileText className="h-4 w-4" /> Inventory Valuation</TabsTrigger>
            <TabsTrigger value="barcodes" className="gap-2"><Tags className="h-4 w-4" /> Barcode Labels</TabsTrigger>
          </TabsList>
          
          <TabsContent value="stock_count">
            <ReportViewer config={stockCountConfig} />
          </TabsContent>
          
          <TabsContent value="valuation">
            <ReportViewer config={inventoryValuationConfig} />
          </TabsContent>

          <TabsContent value="barcodes">
            <div className="bg-card p-4 sm:p-6 rounded-xl border mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold">Print Barcode Labels</h3>
                  <p className="text-sm text-muted-foreground">Optimized for thermal barcode printers and A4 sticker sheets.</p>
                </div>
                <Button onClick={() => window.print()} className="gap-2 shrink-0 w-full sm:w-auto"><Printer className="h-4 w-4" /> Print Labels</Button>
              </div>
              <div className="border bg-gray-50/50 dark:bg-secondary/20 p-4 rounded-lg overflow-y-auto max-h-[60vh]">
                {barcodeItems.length === 0 ? (
                  <p className="text-center text-muted-foreground py-10">No products with barcodes found.</p>
                ) : (
                  <PrintBarcodeLabels items={barcodeItems} />
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Print-only container */}
        <div className="hidden print:block w-full">
          {activeTab === "stock_count" && <ReportViewer config={stockCountConfig} onPrint={() => {}} />}
          {activeTab === "valuation" && <ReportViewer config={inventoryValuationConfig} onPrint={() => {}} />}
          {activeTab === "barcodes" && <PrintBarcodeLabels items={barcodeItems} />}
        </div>
      </div>
    </DashboardLayout>
  );
}
