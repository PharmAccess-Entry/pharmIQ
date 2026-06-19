import { DashboardLayout } from "@/components/DashboardLayout";
import { defaultCategories } from "@/lib/mockData";
import { formatNaira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ImagePlus, Loader2, Tag, X, FolderPlus, Plus, Pencil, Trash2, Sparkles, Check, ArrowRight, Route, GripVertical, Upload, AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/lib/restaurant";
import { getSuggestionsForCategory, menuSuggestions, type Suggestion } from "@/lib/menuSuggestions";
import imageCompression from "browser-image-compression";
import { MenuCardSkeleton, CategoryBubbleSkeleton } from "@/components/LoadingState";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuImportModal } from "@/components/MenuImportModal";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image: string | null;
  available: boolean;
  options: string[] | null;
  pairs_with?: string[] | null;
  track_inventory: boolean;
  stock_quantity: number;
  low_stock_threshold: number;
  auto_hide_out_of_stock: boolean;
  barcode?: string | null;
  expiry_date?: string | null;
  batch_number?: string | null;
  requires_prescription?: boolean | null;
  cost_price: number;
};

type FormState = {
  id?: string;
  name: string;
  description: string;
  price: string;
  category: string;
  image: string;
  available: boolean;
  options: string;
  pairs_with: string[];
  track_inventory: boolean;
  stock_quantity: string;
  low_stock_threshold: string;
  auto_hide_out_of_stock: boolean;
  barcode: string;
  expiry_date: string;
  batch_number: string;
  requires_prescription: boolean;
  cost_price: string;
};

const empty = (cat: string): FormState => ({
  name: "", description: "", price: "", cost_price: "", category: cat, image: "", available: true, options: "", pairs_with: [],
  track_inventory: false, stock_quantity: "0", low_stock_threshold: "5", auto_hide_out_of_stock: false,
  barcode: "", expiry_date: "", batch_number: "", requires_prescription: false
});

const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 0.05, // 50kb
    maxWidthOrHeight: 800,
    useWebWorker: true,
    fileType: "image/webp" as string,
  };
  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error("Compression failed:", error);
    throw new Error("Image compression failed");
  }
};

const MenuManagement = () => {
  const { restaurant, loading: restaurantLoading } = useRestaurant();
  const rid = restaurant?.id;
  const isEvent = restaurant?.business_type === "event";
  const isPharmacy = restaurant?.business_type === "pharmacy";
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [newCat, setNewCat] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [draggedCat, setDraggedCat] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [importModalOpen, setImportModalOpen] = useState(false);

  // Add/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty(defaultCategories[0]));
  const [savingItem, setSavingItem] = useState(false);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optionSearch, setOptionSearch] = useState("");
  const [pairsOpen, setPairsOpen] = useState(false);
  const [pairSearch, setPairSearch] = useState("");
  const formFileRef = useRef<HTMLInputElement>(null);

  // Suggestions modal
  const [sugOpen, setSugOpen] = useState(false);
  const [sugCategory, setSugCategory] = useState<string>("Antibiotics & Antibacterials");
  const [sugQuery, setSugQuery] = useState("");
  const [sugSelected, setSugSelected] = useState<Record<string, Suggestion>>({});
  const [sugSaving, setSugSaving] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // Price follow-up after adding suggested dishes
  const [priceOpen, setPriceOpen] = useState(false);
  const [priceItems, setPriceItems] = useState<MenuItem[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null);



  const loadMenu = useCallback(async () => {
    if (!rid) return;
    const { data } = await supabase.from("menu_items").select("*").eq("restaurant_id", rid).order("category");
    const list = (data as MenuItem[]) || [];
    setItems(list);
    
    const legacyCategories = ["Local Dishes", "Swallow", "Soup", "Proteins", "Pastries", "Drinks", "Intercontinental", "Soups & Swallows", "Small Chops"];
    
    let rawCategories = Array.from(new Set([
      ...defaultCategories, 
      ...(restaurant?.category_order || []),
      ...list.map((i) => i.category)
    ]));

    // Filter out old restaurant categories since we are a pharmacy now
    rawCategories = rawCategories.filter(cat => !legacyCategories.includes(cat));

    if (restaurant?.category_order && restaurant.category_order.length > 0) {
      rawCategories.sort((a, b) => {
        const aIdx = restaurant.category_order!.indexOf(a);
        const bIdx = restaurant.category_order!.indexOf(b);
        if (aIdx === -1 && bIdx === -1) return 0;
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      });
    }
    setCategories(rawCategories);
    setInitialLoad(false);
  }, [rid, restaurant?.category_order]);

  useEffect(() => {
    if (restaurantLoading) return;
    if (!rid) {
      setInitialLoad(false);
      return;
    }
    loadMenu();
    const ch = supabase
      .channel(`menu-mgmt-${rid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items", filter: `restaurant_id=eq.${rid}` }, loadMenu)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [rid, loadMenu, restaurantLoading]);

  const itemsByCat = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    categories.forEach((c) => (map[c] = []));
    items.forEach((i) => { if (!map[i.category]) map[i.category] = []; map[i.category].push(i); });
    return map;
  }, [items, categories]);

  const toggle = async (i: MenuItem) => {
    const next = !i.available;
    setItems((prev) => prev.map((item) => item.id === i.id ? { ...item, available: next } : item));
    const { error } = await supabase.from("menu_items").update({ available: next }).eq("id", i.id);
    if (error) {
      setItems((prev) => prev.map((item) => item.id === i.id ? { ...item, available: i.available } : item));
      toast.error(error.message);
    }
  };

  const onPick = (id: string) => inputRefs.current[id]?.click();

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${rid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("menu-images").upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
  };

  const onFile = async (id: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image");
    if (file.size > 10 * 1024 * 1024) return toast.error("Image is too large (max 10MB). Please choose a smaller photo.");
    
    setUploadingId(id);
    try {
      const compressedFile = await compressImage(file);
      const newFile = new File([compressedFile], `${file.name.split('.')[0]}.webp`, { type: "image/webp" });
      
      const url = await uploadImage(newFile);
      const { error } = await supabase.from("menu_items").update({ image: url }).eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, image: url } : item));
      toast.success("Image updated & optimized");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setUploadingId(null); }
  };

  const onFormFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image");
    
    setUploadingForm(true);
    try {
      const compressedFile = await compressImage(file);
      const newFile = new File([compressedFile], `${file.name.split('.')[0]}.webp`, { type: "image/webp" });
      
      const url = await uploadImage(newFile);
      setForm((p) => ({ ...p, image: url }));
      toast.success("Image optimized");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally { setUploadingForm(false); }
  };

  const openAdd = (cat?: string) => {
    setForm(empty(cat || categories[0] || "Local Dishes"));
    setModalOpen(true);
  };

  const openEdit = (item: MenuItem) => {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: String(item.price),
      cost_price: String(item.cost_price || 0),
      category: item.category,
      image: item.image || "",
      available: item.available,
      options: (item.options || []).join(", "),
      pairs_with: item.pairs_with || [],
      track_inventory: item.track_inventory || false,
      stock_quantity: String(item.stock_quantity || 0),
      low_stock_threshold: String(item.low_stock_threshold || 5),
      auto_hide_out_of_stock: item.auto_hide_out_of_stock || false,
      barcode: item.barcode || "",
      expiry_date: item.expiry_date || "",
      batch_number: item.batch_number || "",
      requires_prescription: item.requires_prescription || false,
    });
    setModalOpen(true);
  };

  const saveItem = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    const isIncluded = /soup|stew|sauce/i.test(form.category);
    const price = (isEvent || isIncluded) ? Number(form.price || 0) : Number(form.price);
    if (!isEvent && !isIncluded && (!price || price < 0)) return toast.error("Enter a valid price");
    if (!form.category) return toast.error("Pick a category");
    setSavingItem(true);
    const payload = {
      restaurant_id: rid,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price,
      cost_price: Number(form.cost_price || 0),
      category: form.category,
      image: form.image || null,
      available: form.available,
      options: form.options.split(",").map(s => s.trim()).filter(Boolean),
      pairs_with: form.pairs_with || [],
      track_inventory: form.track_inventory,
      stock_quantity: form.track_inventory ? Number(form.stock_quantity) || 0 : 0,
      low_stock_threshold: form.track_inventory ? Number(form.low_stock_threshold) || 5 : 5,
      auto_hide_out_of_stock: form.auto_hide_out_of_stock,
      barcode: form.barcode.trim() || null,
      expiry_date: form.expiry_date || null,
      batch_number: form.batch_number.trim() || null,
      requires_prescription: form.requires_prescription,
    };
    let error;
    let data: MenuItem[] | null = null;
    if (form.id) {
      ({ error } = await supabase.from("menu_items").update(payload).eq("id", form.id).select("id").single());
    } else {
      ({ data, error } = await supabase.from("menu_items").insert(payload).select("*"));
    }
    setSavingItem(false);
    if (error) return toast.error(error.message);
    if (form.id) {
      setItems((prev) => prev.map((item) => item.id === form.id ? { ...item, ...payload, restaurant_id: rid } as MenuItem : item));
    } else if (data?.[0]) {
      setItems((prev) => [data[0], ...prev]);
      setCategories((prev) => prev.includes(data[0].category) ? prev : [...prev, data[0].category]);
    }
    toast.success(form.id ? (isPharmacy ? "Product updated" : "Item updated") : (isPharmacy ? "Product added" : "Item added"));
    setModalOpen(false);
  };

  const deleteItem = async () => {
    if (!deleteTarget) return;
    const current = deleteTarget;
    setDeleteTarget(null);
    setItems((prev) => prev.filter((item) => item.id !== current.id));
    const { error } = await supabase.from("menu_items").delete().eq("id", current.id);
    if (error) {
      setItems((prev) => [...prev, current]);
      return toast.error(error.message);
    }
    toast.success(isPharmacy ? "Product deleted" : "Item deleted");
  };

  const saveSuggestionPrices = async () => {
    const invalid = priceItems.find((item) => !Number(priceDrafts[item.id]) || Number(priceDrafts[item.id]) < 0);
    if (invalid) return toast.error(`Enter a valid price for ${invalid.name}`);
    setSavingPrices(true);
    const updates = await Promise.all(
      priceItems.map((item) => supabase.from("menu_items").update({ price: Number(priceDrafts[item.id]) }).eq("id", item.id))
    );
    setSavingPrices(false);
    const error = updates.find((result) => result.error)?.error;
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((item) => priceDrafts[item.id] ? { ...item, price: Number(priceDrafts[item.id]) } : item));
    setPriceOpen(false);
    setPriceItems([]);
    setPriceDrafts({});
    toast.success("Prices updated");
  };

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) return toast.error("Category already exists");
    
    const nextCategories = [...categories, name];
    setCategories(nextCategories); 
    setNewCat(""); 
    
    // Save to DB so empty categories persist
    if (rid) {
       await supabase.from("restaurants").update({ category_order: nextCategories }).eq("id", rid);
    }
    toast.success(`Added "${name}"`);
  };

  const removeCategory = async (cat: string) => {
    const count = items.filter((i) => i.category === cat).length;
    if (count > 0) return toast.error(`Move or delete the ${count} item${count > 1 ? "s" : ""} in "${cat}" first`);
    
    const nextCategories = categories.filter((c) => c !== cat);
    setCategories(nextCategories);
    
    // Save to DB
    if (rid) {
       await supabase.from("restaurants").update({ category_order: nextCategories }).eq("id", rid);
    }
  };

  const moveCategory = async (dragged: string, target: string) => {
    if (dragged === target || !rid) return;
    setCategories((prev) => {
      const next = [...prev];
      const draggedIdx = next.indexOf(dragged);
      const targetIdx = next.indexOf(target);
      if (draggedIdx === -1 || targetIdx === -1) return next;
      next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, dragged);
      supabase.from("restaurants").update({ category_order: next }).eq("id", rid).then(({error}) => {
        if (error) toast.error("Failed to save category order");
        else toast.success("Category order saved! Customers will see this new arrangement.");
      });
      return next;
    });
  };

  const smartSplit = async (cat: string) => {
    const sw = ["pounded yam", "fufu", "amala", "eba", "garri", "semo", "wheat", "tuwo", "semovita", "semolina", "starch"];
    setSavingItem(true);
    const catItems = items.filter(i => i.category === cat);
    const updates = await Promise.all(catItems.map(item => {
      const isSwallow = sw.some(s => item.name.toLowerCase().includes(s)) || /swallow/i.test(item.description || "");
      const targetCat = isSwallow ? "Swallow" : "Soup";
      return supabase.from("menu_items").update({ category: targetCat }).eq("id", item.id);
    }));
    setSavingItem(false);
    const err = updates.find(r => r.error)?.error;
    if (err) toast.error(err.message);
    else {
      toast.success(`Split items into "Soup" and "Swallow"`);
      loadMenu();
    }
  };

  const openSuggestions = (cat: string) => {
    setSugCategory(cat);
    setSugQuery("");
    setSugSelected({});
    setSugOpen(true);
  };

  const toggleSug = (s: Suggestion) => {
    setSugSelected((p) => {
      const next = { ...p };
      if (next[s.name]) delete next[s.name]; else next[s.name] = s;
      return next;
    });
  };

  const addSelectedSuggestions = async () => {
    const list = Object.values(sugSelected);
    if (!list.length) return toast.error("Tick at least one item");
    if (!rid) return;
    setSugSaving(true);

    const isAllCats = sugCategory === "All Categories";

    // In "All Categories" mode, check duplicates globally across all items.
    // Otherwise, check only within the selected category.
    const existingNames = new Set(
      (isAllCats ? items : items.filter((i) => i.category === sugCategory))
        .map((i) => i.name.toLowerCase())
    );

    const rows = list
      .filter((s) => !existingNames.has(s.name.toLowerCase()))
      .map((s) => {
        // Resolve the real pharmacological category for this drug.
        // This fixes the bug where drugs added from "All Categories" mode
        // were saved with category = "All Categories" instead of their real category.
        let realCategory = sugCategory;
        if (isAllCats) {
          for (const [cat, drugs] of Object.entries(menuSuggestions)) {
            if (drugs.some((d) => d.name === s.name)) {
              realCategory = cat;
              break;
            }
          }
        }
        return {
          restaurant_id: rid,
          name: s.name,
          description: s.description,
          price: 0,
          category: realCategory,
          image: s.image,
          available: true,
        };
      });

    if (!rows.length) {
      setSugSaving(false);
      toast.error("All selected items already exist in your inventory");
      return;
    }
    const { data, error } = await supabase.from("menu_items").insert(rows).select("*");
    setSugSaving(false);
    if (error) return toast.error(error.message);
    const added = (data as MenuItem[]) || [];
    setItems((prev) => [...added, ...prev]);
    // Update categories list — may have multiple new categories (e.g. from All Categories mode)
    const addedCats = [...new Set(added.map((i) => i.category))];
    setCategories((prev) => {
      const next = [...prev];
      addedCats.forEach((c) => { if (!next.includes(c)) next.push(c); });
      return next;
    });
    setSugOpen(false);
    setSugSelected({});
    if (!isEvent && added.length) {
      setPriceItems(added);
      setPriceDrafts(Object.fromEntries(added.map((item) => [item.id, ""])));
      setPriceOpen(true);
      toast.success(`Added ${added.length} item${added.length > 1 ? "s" : ""} — add prices now`);
    } else {
      toast.success(`Added ${added.length || rows.length} item${(added.length || rows.length) > 1 ? "s" : ""}`);
    }
  };

  const startRename = (cat: string) => { setRenaming(cat); setRenameValue(cat); };
  const commitRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name || name === renaming) { setRenaming(null); return; }
    if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) return toast.error("Category already exists");
    
    const nextCategories = categories.map((c) => (c === renaming ? name : c));
    setCategories(nextCategories);
    await supabase.from("menu_items").update({ category: name }).eq("restaurant_id", rid).eq("category", renaming);
    if (rid) {
      await supabase.from("restaurants").update({ category_order: nextCategories }).eq("id", rid);
    }
    setRenaming(null); toast.success("Category renamed");
  };

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">{isPharmacy ? "Products" : "Menu"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{items.length} {isPharmacy ? "products" : "items"} across {categories.length} categories</p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button size="sm" variant="outline" onClick={() => openSuggestions("All Categories")} className="whitespace-nowrap px-2 sm:px-3 text-xs">
            <Sparkles className="h-3.5 w-3.5 mr-1" />Browse
          </Button>
          <Button size="sm" variant="outline" onClick={() => setImportModalOpen(true)} className="whitespace-nowrap px-2 sm:px-3 text-xs">
            <Upload className="h-3.5 w-3.5 mr-1" />Import
          </Button>
          <Button size="sm" variant="hero" onClick={() => openAdd()} className="whitespace-nowrap px-2 sm:px-3 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />Add {isPharmacy ? "product" : "item"}
          </Button>
        </div>
      </div>

      {initialLoad ? (
        <div className="space-y-8">
          <div className="bg-card border border-border rounded-2xl p-5 mb-8 shadow-soft">
            <CategoryBubbleSkeleton />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="mb-8">
              <Skeleton className="h-6 w-32 mb-4 rounded-md" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, j) => <MenuCardSkeleton key={j} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 mb-8 shadow-soft">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-primary" />
              <h2 className="font-display font-semibold">Categories</h2>
              <span className="text-xs text-muted-foreground ml-auto hidden sm:block">Long-press & drag to reorder · Tap to rename</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const count = itemsByCat[c]?.length ?? 0;
                if (renaming === c) {
                  return (
                    <div key={c} className="flex items-center gap-1 bg-secondary rounded-full pl-2 pr-1 py-0.5">
                      <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                        onBlur={commitRename}
                        className="h-7 w-32 border-0 bg-transparent px-1 text-xs focus-visible:ring-0" />
                    </div>
                  );
                }
                return (
                  <span key={c} 
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c);
                      setDraggedCat(c);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragged = e.dataTransfer.getData("text/plain");
                      if (dragged && dragged !== c) {
                        moveCategory(dragged, c);
                      }
                      setDraggedCat(null);
                    }}
                    onDragEnd={() => setDraggedCat(null)}
                    className={`inline-flex items-center gap-1.5 bg-secondary text-foreground rounded-full pl-3 pr-1 py-1 text-xs font-medium cursor-grab active:cursor-grabbing transition-transform ${draggedCat === c ? "opacity-50 scale-95" : ""}`}
                  >
                    <button onClick={() => startRename(c)} className="hover:text-primary">{c}</button>
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                    {c.toLowerCase().includes("soup") && c.toLowerCase().includes("swallow") && count > 0 && (
                      <button onClick={() => smartSplit(c)} title="Split into Soup & Swallow categories"
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all">
                        <Sparkles className="h-2.5 w-2.5" />
                        <span className="text-[9px] font-bold">Split</span>
                      </button>
                    )}
                    <button onClick={() => removeCategory(c)} aria-label={`Remove ${c}`}
                      className="grid place-items-center h-5 w-5 rounded-full text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-smooth">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2 mt-4">
              <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategory()} placeholder="e.g. Grills, Continental..." className="h-9" />
              <Button onClick={addCategory} variant="outline" className="shrink-0"><FolderPlus className="h-4 w-4" />Add</Button>
            </div>
          </div>

          {categories.map((cat) => {
            const catItems = itemsByCat[cat] ?? [];
            return (
              <div key={cat} className="mb-8">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="font-display font-semibold text-base sm:text-lg min-w-0 truncate">{cat}</h2>
                  <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">{catItems.length} {isPharmacy ? (catItems.length === 1 ? "product" : "products") : (catItems.length === 1 ? "item" : "items")}</span>
                    {getSuggestionsForCategory(cat).length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => openSuggestions(cat)} className="h-8 px-2 text-[11px] sm:text-xs whitespace-nowrap">
                        <Sparkles className="h-3.5 w-3.5" />Suggestions
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openAdd(cat)} className="h-8 px-2 text-[11px] sm:text-xs whitespace-nowrap"><Plus className="h-3.5 w-3.5" />Add</Button>
                  </div>
                </div>
                {catItems.length === 0 ? (
                  <button onClick={() => openAdd(cat)} className="w-full rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-smooth">
                    <Plus className="h-4 w-4 inline mr-1" /> Add the first {isPharmacy ? "product" : "item"} to <span className="font-medium text-foreground">{cat}</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {catItems.map((item) => (
                  <div key={item.id} className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden hover:shadow-elevated transition-smooth">
                    <div className="aspect-[4/3] bg-secondary relative group cursor-pointer" onClick={() => onPick(item.id)}>
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : isPharmacy ? (
                        <div className="w-full h-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center p-3 border border-primary/10">
                          <span className="text-[14px] font-bold text-primary text-center leading-tight line-clamp-3 break-words">{item.name}</span>
                        </div>
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground"><ImagePlus className="h-7 w-7" /></div>
                      )}
                      {!item.available && <div className="absolute inset-0 bg-foreground/40 grid place-items-center text-card font-medium text-sm pointer-events-none">Unavailable</div>}
                      <div className="absolute inset-0 bg-black/0 md:group-hover:bg-black/50 transition-smooth grid place-items-center text-white opacity-0 md:group-hover:opacity-100 pointer-events-none">
                        {uploadingId === item.id ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="text-xs font-semibold shadow-sm">Change photo</span>}
                      </div>
                      <input ref={(el) => (inputRefs.current[item.id] = el)} type="file" accept="image/*" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => onFile(item.id, e.target.files?.[0])} />
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                        {!isEvent && <span className="font-display font-bold text-primary text-sm whitespace-nowrap">{formatNaira(Number(item.price))}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                      <div className="flex items-center justify-between gap-2 mt-3 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Switch checked={item.available} onCheckedChange={() => toggle(item)} />
                          <span className="text-[10px] text-muted-foreground truncate">{item.available ? "Live" : "Off"}</span>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(item)} aria-label="Edit" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(item)} aria-label="Delete" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? `Edit ${isPharmacy ? "product" : "menu item"}` : `Add ${isPharmacy ? "product" : "menu item"}`}</DialogTitle>
            <DialogDescription className="sr-only">
              Fill out the form below to {form.id ? "edit the" : "add a new"} product.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Photo</Label>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-20 w-20 rounded-xl bg-secondary overflow-hidden grid place-items-center shrink-0">
                  {form.image ? <img src={form.image} alt="" className="w-full h-full object-cover" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}
                </div>
                <input ref={formFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFormFile(e.target.files?.[0])} />
                <Button type="button" variant="outline" onClick={() => formFileRef.current?.click()} disabled={uploadingForm}>
                  {uploadingForm ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {form.image ? "Replace" : "Upload"}
                </Button>
              </div>
            </div>
            <div>
              <Label className="flex items-center justify-between">
                <span>Name *</span>
                <span className={`text-[10px] font-medium ${form.name.length > 70 ? 'text-destructive' : 'text-muted-foreground'}`}>{form.name.length}/80</span>
              </Label>
              <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value.slice(0, 80) }))} placeholder="e.g. Amoxicillin 500mg" className="mt-1.5" maxLength={80} />
            </div>
            <div>
              <Label className="flex items-center justify-between">
                <span>Description</span>
                <span className={`text-[10px] font-medium ${form.description.length > 180 ? 'text-destructive' : 'text-muted-foreground'}`}>{form.description.length}/200</span>
              </Label>
              <Textarea value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value.slice(0, 200) }))} placeholder="Short description shown to customers" className="mt-1.5" rows={2} maxLength={200} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!isEvent && (
                <>
                  <div>
                    <Label>Price (₦) {!/soup|stew|sauce/i.test(form.category) && "*"}</Label>
                    <div className="relative">
                        <Input 
                          type="text" 
                          value={form.price ? Number(form.price).toLocaleString("en-NG") : ""} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, "");
                            if (val === "" || /^\d+$/.test(val)) {
                              setForm(prev => ({ ...prev, price: val }));
                            }
                          }} 
                          placeholder={/soup|stew|sauce/i.test(form.category) ? "0 (Optional)" : "2,500"} 
                          className="mt-1.5" 
                        />
                      {/soup|stew|sauce/i.test(form.category) && !form.price && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded border border-green-100 mt-1">Included ✓</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Cost Price (₦)</Label>
                    <div className="relative">
                        <Input 
                          type="text" 
                          value={form.cost_price ? Number(form.cost_price).toLocaleString("en-NG") : ""} 
                          onChange={(e) => {
                            const val = e.target.value.replace(/,/g, "");
                            if (val === "" || /^\d+$/.test(val)) {
                              setForm(prev => ({ ...prev, cost_price: val }));
                            }
                          }} 
                          placeholder="1,500" 
                          className="mt-1.5" 
                        />
                    </div>
                  </div>
                </>
              )}
              <div className="col-span-2">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {Array.from(new Set([...categories, form.category])).filter(Boolean).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Selection Options (e.g. Egusi, Okro, Vegetable)</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {form.options.split(",").map(opt => opt.trim()).filter(Boolean).map(opt => (
                  <span key={opt} className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border border-primary/20">
                    {opt}
                    <button type="button" onClick={() => {
                       const newOpts = form.options.split(",").map(o=>o.trim()).filter(o => o && o !== opt).join(", ");
                       setForm(prev => ({...prev, options: newOpts}));
                    }} className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
              <div className="relative">
                <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal border-dashed">
                      <Plus className="h-4 w-4 mr-2" /> Select or add options...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandInput placeholder="Search menu items or type custom..." onValueChange={setOptionSearch} />
                      <CommandList>
                        <CommandEmpty className="p-1">
                          {optionSearch ? (
                            <Button variant="ghost" className="w-full justify-start text-left px-2 py-1.5 h-auto text-sm" onClick={() => {
                              const current = form.options.split(",").map(o=>o.trim()).filter(Boolean);
                              if (!current.includes(optionSearch.trim())) {
                                setForm(prev => ({...prev, options: [...current, optionSearch.trim()].join(", ")}));
                              }
                              setOptionsOpen(false);
                              setOptionSearch("");
                            }}>
                              Add custom: <strong className="ml-1">"{optionSearch}"</strong>
                            </Button>
                          ) : <div className="text-sm text-center py-4 text-muted-foreground">Type to search or add</div>}
                        </CommandEmpty>
                        <CommandGroup className="max-h-48 overflow-y-auto">
                          {items.filter(i => !form.options.split(",").map(o=>o.trim()).filter(Boolean).includes(i.name)).map(item => (
                            <CommandItem key={item.id} onSelect={() => {
                              const current = form.options.split(",").map(o=>o.trim()).filter(Boolean);
                              setForm(prev => ({...prev, options: [...current, item.name].join(", ")}));
                              setOptionsOpen(false);
                              setOptionSearch("");
                            }}>
                              {item.name} <span className="text-muted-foreground ml-2 text-[10px] uppercase tracking-wider">{item.category}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                If set, customers must pick one before adding to cart. Perfect for <strong>Soup & Swallow</strong> pairings.
              </p>
            </div>

            <div>
              <Label>Frequently Paired With (Upsell suggestions)</Label>
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {(form.pairs_with || []).map(pairId => {
                  const pairedItem = items.find(i => i.id === pairId);
                  if (!pairedItem) return null;
                  return (
                    <span key={pairId} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border border-emerald-500/20">
                      {pairedItem.name}
                      <button type="button" onClick={() => {
                         const newPairs = form.pairs_with.filter(id => id !== pairId);
                         setForm(prev => ({...prev, pairs_with: newPairs}));
                      }} className="hover:bg-emerald-500/20 rounded-full p-0.5 transition-colors"><X className="h-3 w-3" /></button>
                    </span>
                  );
                })}
              </div>
              <div className="relative">
                <Popover open={pairsOpen} onOpenChange={setPairsOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-muted-foreground font-normal border-dashed">
                      <Plus className="h-4 w-4 mr-2" /> Link pairing items...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                    <Command>
                      <CommandInput placeholder="Search items to pair..." onValueChange={setPairSearch} />
                      <CommandList>
                        <CommandEmpty className="p-1">
                          <div className="text-sm text-center py-4 text-muted-foreground">No matching items</div>
                        </CommandEmpty>
                        <CommandGroup className="max-h-48 overflow-y-auto">
                          {items.filter(i => i.id !== form.id && !(form.pairs_with || []).includes(i.id)).map(item => (
                            <CommandItem key={item.id} onSelect={() => {
                              setForm(prev => ({...prev, pairs_with: [...(prev.pairs_with || []), item.id]}));
                              setPairsOpen(false);
                              setPairSearch("");
                            }}>
                              {item.name} <span className="text-muted-foreground ml-2 text-[10px] uppercase tracking-wider">{item.category}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Items selected here will be recommended to customers as beautiful addon recommendations when they add this item to their cart.
              </p>
            </div>
            
            {/* Inventory Management Section */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-sm">Inventory Tracking</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Automatically manage stock levels and get low stock alerts</p>
                </div>
                <Switch checked={form.track_inventory} onCheckedChange={(v) => setForm(prev => ({ ...prev, track_inventory: v }))} />
              </div>

              {form.track_inventory && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-secondary/50 rounded-xl mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Current Stock</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={form.stock_quantity} 
                      onChange={(e) => setForm(prev => ({ ...prev, stock_quantity: e.target.value }))} 
                      className="mt-1.5 h-9 bg-card" 
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Low Stock Alert at</Label>
                    <Input 
                      type="number" 
                      min="0"
                      value={form.low_stock_threshold} 
                      onChange={(e) => setForm(prev => ({ ...prev, low_stock_threshold: e.target.value }))} 
                      className="mt-1.5 h-9 bg-card" 
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <Label className="text-xs font-normal">Auto-hide when out of stock</Label>
                    <Switch 
                      checked={form.auto_hide_out_of_stock} 
                      onCheckedChange={(v) => setForm(prev => ({ ...prev, auto_hide_out_of_stock: v }))} 
                      className="scale-75 origin-right"
                    />
                  </div>
                </div>
              )}
            </div>

            {isPharmacy && (
              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-sm">Pharmacy Tracking</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Manage barcode, expiry, and prescription rules</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Barcode (UPC/EAN)</Label>
                    <Input 
                      value={form.barcode} 
                      onChange={(e) => setForm(prev => ({ ...prev, barcode: e.target.value }))} 
                      className="mt-1.5 h-9 bg-card" 
                      placeholder="Scan or enter barcode"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Batch Number</Label>
                    <Input 
                      value={form.batch_number} 
                      onChange={(e) => setForm(prev => ({ ...prev, batch_number: e.target.value }))} 
                      className="mt-1.5 h-9 bg-card" 
                      placeholder="e.g. BATCH-A1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Expiry Date</Label>
                    <Input 
                      type="date"
                      value={form.expiry_date} 
                      onChange={(e) => setForm(prev => ({ ...prev, expiry_date: e.target.value }))} 
                      className="mt-1.5 h-9 bg-card" 
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <Label className="text-xs font-semibold text-destructive flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Requires Prescription (Rx)
                    </Label>
                    <Switch 
                      checked={form.requires_prescription} 
                      onCheckedChange={(v) => setForm(prev => ({ ...prev, requires_prescription: v }))} 
                      className="scale-75 origin-right"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-3 py-2">
              <div>
                <div className="text-sm font-medium">In stock</div>
                <div className="text-xs text-muted-foreground">Customers can order this item</div>
              </div>
              <Switch checked={form.available} onCheckedChange={(v) => setForm(prev => ({ ...prev, available: v }))} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={saveItem} disabled={savingItem}>
              {savingItem ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {form.id ? "Save changes" : (isPharmacy ? "Add product" : "Add item")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suggestions browser */}
      <Dialog open={sugOpen} onOpenChange={setSugOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="p-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Add from suggestions</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">Tick the drugs you stock. You can edit prices after adding.</DialogDescription>
          </DialogHeader>
          <div className="px-5 pt-3 pb-2 flex flex-col sm:flex-row gap-2">
            <Select value={sugCategory} onValueChange={(v) => { setSugCategory(v); setSugSelected({}); }}>
              <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All Categories">All Categories</SelectItem>
                {Object.keys(menuSuggestions).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={sugQuery} onChange={(e) => setSugQuery(e.target.value)} placeholder="Search e.g. Amoxicillin, Paracetamol, Coartem..." />
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            {(() => {
              // When user is typing, automatically search across ALL categories
              // regardless of the selected category tab — fixes cross-category search.
              const isSearching = sugQuery.trim() !== "";
              const flatAll = (() => {
                // Deduplicate by name — some drugs appear in multiple categories
                // (e.g. Doxycycline in Antimalarials + Antibiotics). Deduplication
                // prevents duplicate React keys and avoids showing the same drug twice.
                const seen = new Set<string>();
                return Object.values(menuSuggestions).flat().filter((s) => {
                  if (seen.has(s.name)) return false;
                  seen.add(s.name);
                  return true;
                });
              })();
              const allForCat = (sugCategory === "All Categories" || isSearching)
                ? flatAll
                : getSuggestionsForCategory(sugCategory);
              const filtered = isSearching
                ? allForCat.filter((s) => s.name.toLowerCase().includes(sugQuery.toLowerCase()) || s.description.toLowerCase().includes(sugQuery.toLowerCase()))
                : allForCat;
              if (filtered.length === 0) {
                return (
                  <div className="text-center py-10 text-sm text-muted-foreground">
                    {allForCat.length === 0 ? "No suggestions for this category yet — use Add item." : `No drugs matching "${sugQuery}" — try a different spelling or check the spelling.`}
                  </div>
                );
              }
              return (
                <>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    {filtered.length} drug{filtered.length !== 1 ? 's' : ''} found
                    {isSearching && sugCategory !== "All Categories" && (
                      <span className="ml-1.5 text-primary font-medium">· searching all categories</span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {filtered.map((s, i) => {
                      const sel = !!sugSelected[s.name];
                      return (
                        <button key={`${i}-${s.name}`} type="button" onClick={() => toggleSug(s)}
                          className={`relative text-left rounded-xl border-2 overflow-hidden transition-all ${sel ? "border-primary shadow-glow" : "border-border hover:border-primary/40"}`}>
                          <div className="aspect-[4/3] bg-secondary relative">
                            {s.image ? (
                              <img src={s.image} alt={s.name} loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center p-3 border border-primary/10">
                                <span className="text-[14px] font-bold text-primary text-center leading-tight line-clamp-3 break-words">{s.name}</span>
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <div className="font-semibold text-xs leading-tight">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{s.description}</div>
                          </div>
                          {sel && (
                            <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow">
                              <Check className="h-3.5 w-3.5" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter className="p-4 border-t border-border gap-2 sm:gap-2">
            <div className="text-xs text-muted-foreground mr-auto self-center whitespace-nowrap">
              {Object.keys(sugSelected).length} selected
            </div>
            <Button variant="ghost" onClick={() => setSugOpen(false)}>Cancel</Button>
            <Button variant="hero" onClick={addSelectedSuggestions} disabled={sugSaving || !Object.keys(sugSelected).length}>
              {sugSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add {Object.keys(sugSelected).length || ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceOpen} onOpenChange={setPriceOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add prices</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">Set customer-facing prices for the suggested products you just added.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {priceItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_8rem] items-center gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{item.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{item.category}</div>
                </div>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={priceDrafts[item.id] ? Number(priceDrafts[item.id]).toLocaleString("en-NG") : ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/,/g, "");
                    if (val === "" || /^\d+$/.test(val)) {
                      setPriceDrafts((prev) => ({ ...prev, [item.id]: val }));
                    }
                  }}
                  placeholder="2,500"
                  className="h-9"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setPriceOpen(false)}>Skip</Button>
            <Button variant="hero" onClick={saveSuggestionPrices} disabled={savingPrices}>
              {savingPrices ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save prices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `"${deleteTarget.name}" will be removed from your inventory. This cannot be undone.` : "This product will be removed from your inventory."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteItem} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete product</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}

      <MenuImportModal
        isOpen={importModalOpen}
        onOpenChange={setImportModalOpen}
        restaurantId={rid}
        onSuccess={loadMenu}
        existingCategories={categories}
        isPharmacy={isPharmacy}
      />
    </DashboardLayout>
  );
};
export default MenuManagement;
