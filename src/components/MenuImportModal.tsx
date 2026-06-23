import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, FileSpreadsheet, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import * as XLSX from "xlsx";

type MenuImportModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | undefined;
  onSuccess: () => void;
  existingCategories: string[];
  isPharmacy?: boolean;
};

type ParsedRow = {
  Category: string;
  Name: string;
  Description: string;
  Price: number;
  CostPrice: number;
  OpeningStock: number | null;  // null = blank (not the same as 0)
  LowStockThreshold: number;
  BatchNumber: string;
  ExpiryDate: string;
  Barcode: string;
  RequiresPrescription: boolean;
  Unit: string;
  Error?: string;
};

export function MenuImportModal({ isOpen, onOpenChange, restaurantId, onSuccess, existingCategories, isPharmacy = false }: MenuImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templateRows = isPharmacy ? [
    ["Category", "Name", "Description", "Price", "Cost Price", "Opening Stock", "Unit", "Low Stock Threshold", "Batch Number", "Expiry Date", "Barcode", "Requires Prescription"],
    ["Antimalarials", "Artemether + Lumefantrine 80/480mg", "First-line ACT adult dose", 1500, 1000, 50, "Tablet", 10, "BAT-001", "2026-12-31", "123456789", "Yes"],
    ["Analgesics & Pain Relief", "Paracetamol 500mg", "Standard pain relief", 200, 100, 100, "Tablet", 20, "", "", "", "No"],
    ["Antibiotics & Antibacterials", "Amoxicillin 500mg", "Broad-spectrum antibiotic", 1000, 800, 30, "Capsule", 5, "", "2025-06-30", "", "Yes"],
  ] : [
    ["Category", "Name", "Description", "Price", "Cost Price"],
    ["Swallow", "Pounded Yam", "Smooth and stretchy pounded yam", 1500, 500],
    ["Soup", "Egusi Soup", "Rich melon soup with assorted meat", 0, 0],
    ["Drinks", "Zobo", "Chilled zobo drink", 500, 200],
  ];

  const handleDownloadCSV = () => {
    const csvContent = templateRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", isPharmacy ? "pharmiq_inventory_template.csv" : "smarttable_menu_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadXLSX = () => {
    const worksheet = XLSX.utils.aoa_to_sheet(templateRows);
    // Style the header row (bold, background)
    const headerCols = ["A1", "B1", "C1", "D1", "E1"];
    headerCols.forEach(cell => {
      if (worksheet[cell]) {
        worksheet[cell].s = { font: { bold: true }, fill: { fgColor: { rgb: "E11D48" } } };
      }
    });
    // Set column widths
    worksheet["!cols"] = isPharmacy 
      ? [{ wch: 16 }, { wch: 22 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }]
      : [{ wch: 16 }, { wch: 22 }, { wch: 40 }, { wch: 10 }, { wch: 12 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isPharmacy ? "Inventory" : "Menu");
    XLSX.writeFile(workbook, isPharmacy ? "pharmiq_inventory_template.xlsx" : "smarttable_menu_template.xlsx");
  };

  const parseFile = async (selectedFile: File) => {
    setIsParsing(true);
    setParsedData([]);
    
    try {
      const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      
      if (isExcel) {
        const buffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];
        processRawData(json);
      } else {
        Papa.parse(selectedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            processRawData(results.data);
          },
          error: (error) => {
            toast.error(`Error parsing CSV: ${error.message}`);
            setIsParsing(false);
          }
        });
      }
    } catch (error: any) {
      toast.error(`Failed to read file: ${error.message}`);
      setIsParsing(false);
    }
  };

  const processRawData = (data: any[]) => {
    const processed: ParsedRow[] = data.map((row: any, index: number) => {
      // Handle different possible column names (case insensitive matching)
      const getVal = (keys: string[]) => {
        const key = Object.keys(row).find(k => keys.some(match => k.toLowerCase().trim() === match));
        return key ? row[key] : undefined;  // return undefined when column is absent
      };

      const category = getVal(["category", "group", "type"])?.toString().trim();
      const name = getVal(["name", "item", "item name", "dish"])?.toString().trim();
      const description = getVal(["description", "desc", "details"])?.toString().trim() || "";
      const rawPrice = getVal(["price", "cost", "amount", "retail price"]);
      const rawCostPrice = getVal(["cost price", "cost_price", "wholesale price", "buying price"]);
      const rawOpeningStock = getVal(["opening stock", "stock", "qty", "quantity"]);
      const rawLowStockThreshold = getVal(["low stock threshold", "threshold", "min stock", "alert level"]);
      const batchNumber = getVal(["batch number", "batch", "lot"])?.toString().trim() || "";
      const expiryDate = getVal(["expiry date", "expiry", "exp date", "expiration"])?.toString().trim() || "";
      const barcode = getVal(["barcode", "upc", "ean"])?.toString().trim() || "";
      const rawRequiresPrescription = getVal(["requires prescription", "prescription", "rx"]);
      const rawUnit = getVal(["unit", "unit of measure", "uom"]);
      const unit = rawUnit !== undefined && rawUnit !== null ? rawUnit.toString().trim() : "";
      
      let price = 0;
      if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
        const parsed = parseFloat(rawPrice.toString().replace(/,/g, ''));
        if (!isNaN(parsed) && parsed >= 0) price = parsed;
      }

      let costPrice = 0;
      if (rawCostPrice !== undefined && rawCostPrice !== null && rawCostPrice !== "") {
        const parsed = parseFloat(rawCostPrice.toString().replace(/,/g, ''));
        if (!isNaN(parsed) && parsed >= 0) costPrice = parsed;
      }

      // Opening stock: null = column missing or cell blank (NOT the same as 0)
      let openingStock: number | null = null;
      if (rawOpeningStock !== undefined && rawOpeningStock !== null && rawOpeningStock.toString().trim() !== "") {
        const parsed = parseInt(rawOpeningStock.toString().replace(/,/g, ''));
        if (!isNaN(parsed) && parsed >= 0) openingStock = parsed;
      }

      let lowStockThreshold = 5;
      if (rawLowStockThreshold !== undefined && rawLowStockThreshold !== null && rawLowStockThreshold !== "") {
        const parsed = parseInt(rawLowStockThreshold.toString().replace(/,/g, ''));
        if (!isNaN(parsed) && parsed >= 0) lowStockThreshold = parsed;
      }

      let requiresPrescription = false;
      if (rawRequiresPrescription !== undefined && rawRequiresPrescription !== null && rawRequiresPrescription !== "") {
        const val = rawRequiresPrescription.toString().toLowerCase().trim();
        if (val === 'yes' || val === 'true' || val === '1' || val === 'y') requiresPrescription = true;
      }

      let error = undefined;
      if (!category) error = "Category is missing";
      else if (!name) error = "Name is missing";
      else if (isPharmacy && price <= 0) error = "Selling price must be greater than 0";
      else if (isPharmacy && costPrice <= 0) error = "Cost price must be greater than 0";
      else if (isPharmacy && openingStock === null) error = "Opening stock is required — enter 0 if none in stock (blank is not allowed)";
      else if (isPharmacy && !unit) error = "Unit of Measure is required (e.g. Tablet, Capsule, Pack)";

      return {
        Category: category,
        Name: name,
        Description: description,
        Price: price,
        CostPrice: costPrice,
        OpeningStock: openingStock,
        LowStockThreshold: lowStockThreshold,
        BatchNumber: batchNumber,
        ExpiryDate: expiryDate,
        Barcode: barcode,
        RequiresPrescription: requiresPrescription,
        Unit: unit,
        Error: error
      };
    });

    setParsedData(processed);
    setIsParsing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!restaurantId || parsedData.length === 0) return;
    
    const hasErrors = parsedData.some(row => row.Error);
    if (hasErrors) {
      return toast.error("Please fix errors in the file before importing.");
    }

    setIsImporting(true);

    try {
      // 1. Gather unique new categories
      const fileCategories = Array.from(new Set(parsedData.map(r => r.Category)));
      const newCategories = fileCategories.filter(c => !existingCategories.some(ec => ec.toLowerCase() === c.toLowerCase()));
      
      if (newCategories.length > 0) {
        const nextCategories = [...existingCategories, ...newCategories];
        await supabase.from("restaurants").update({ category_order: nextCategories }).eq("id", restaurantId);
      }

      // 2. Insert items
      if (isPharmacy) {
        // Use the bulk import RPC for pharmacy to handle stock, batches, and deduplication
        const payload = parsedData.map(row => ({
          category: row.Category,
          name: row.Name,
          description: row.Description || null,
          price: row.Price,
          cost_price: row.CostPrice,
          opening_stock: row.OpeningStock ?? 0,
          low_stock_threshold: row.LowStockThreshold,
          batch_number: row.BatchNumber || null,
          expiry_date: row.ExpiryDate || null,
          barcode: row.Barcode || null,
          requires_prescription: row.RequiresPrescription,
          unit: row.Unit || null,
        }));

        const { error } = await supabase.rpc("bulk_import_products", {
          p_restaurant_id: restaurantId,
          p_products: payload
        });

        if (error) throw error;
      } else {
        const payload = parsedData.map(row => ({
          restaurant_id: restaurantId,
          category: row.Category,
          name: row.Name,
          description: row.Description || null,
          price: row.Price,
          cost_price: row.CostPrice,
          available: true,
        }));

        // Insert in chunks of 100 to avoid request too large errors
        const chunkSize = 100;
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize);
          const { error } = await supabase.from("menu_items").insert(chunk);
          if (error) throw error;
        }
      }

      toast.success(`Successfully imported ${parsedData.length} items!`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Failed to import items");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    onOpenChange(false);
  };

  const hasErrors = parsedData.some(row => row.Error);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            Import Menu Items
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel (.xlsx) file to bulk create categories and menu items.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {!file && (
            <div className="space-y-6">
              {/* Image notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800">Images not included</p>
                  <p className="text-amber-700">Item photos can't be added via spreadsheet. After importing, go to each item to upload an image.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-secondary/30 p-6 rounded-2xl border border-border flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <Download className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">1. Download Template</h3>
                    <p className="text-sm text-muted-foreground">Choose your preferred format. Excel is recommended — you can open it directly in Microsoft Excel or Google Sheets.</p>
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <Button variant="hero" onClick={handleDownloadXLSX} className="w-full">
                      <FileSpreadsheet className="h-4 w-4" /> Download Excel (.xlsx)
                    </Button>
                    <Button variant="outline" onClick={handleDownloadCSV} className="w-full">
                      <Download className="h-4 w-4" /> Download CSV
                    </Button>
                  </div>
                </div>

                <div className="bg-secondary/30 p-6 rounded-2xl border border-border flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">2. Upload Filled File</h3>
                    <p className="text-sm text-muted-foreground">Fill in your menu data, then upload your completed <strong>.xlsx</strong> or <strong>.csv</strong> file below.</p>
                  </div>
                  <div className="w-full">
                    <Input 
                      type="file" 
                      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                      onChange={handleFileChange}
                      className="hidden"
                      ref={fileInputRef}
                    />
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                      Select File
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isParsing && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-4" />
              <p>Parsing file...</p>
            </div>
          )}

          {file && !isParsing && parsedData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Found {parsedData.length} items
                  </h3>
                  <p className="text-sm text-muted-foreground">{file.name}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                  Change File
                </Button>
              </div>

              {hasErrors && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Action Required</p>
                    <p>Some rows have errors. Please fix them in your file and upload again. Items without a price will default to ₦0.</p>
                  </div>
                </div>
              )}

              <div className="border border-border rounded-xl overflow-hidden max-h-[40vh] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-secondary/50 sticky top-0">
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Cost Price</TableHead>
                      {isPharmacy && <TableHead>Init Stock</TableHead>}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, i) => (
                      <TableRow key={i} className={row.Error ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">{row.Category || "—"}</TableCell>
                        <TableCell>
                          <div>{row.Name || "—"}</div>
                          {row.Description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{row.Description}</div>}
                        </TableCell>
                        <TableCell>{row.Price}</TableCell>
                        <TableCell>{row.CostPrice}</TableCell>
                        {isPharmacy && <TableCell>{row.OpeningStock}</TableCell>}
                        <TableCell>
                          {row.Error ? (
                            <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> {row.Error}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Ready
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4 mt-auto">
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={!file || hasErrors || isImporting || isParsing || parsedData.length === 0}
            className="min-w-[120px]"
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            {isImporting ? "Importing..." : `Import ${parsedData.length || ""} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
