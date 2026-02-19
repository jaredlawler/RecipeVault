import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit, Plus, Home, Download, Upload, FileSpreadsheet, Users } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
type InventoryItem = {
  id: string;
  name: string;
  unitQuantity: string;
  unit: string;
  unitPrice: string;
  variableWeight: boolean;
  defaultWeight: string;
  portionsPerUnit: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
  caloriesPer100g: string;
  notes: string;
  supplierId: string | null;
};
type Supplier = {
  id: string;
  name: string;
};

/**
 * Compute cost-per-unit from raw form values, applying the same unit
 * normalisation that happens on save (kg→g, L→ml, etc.).
 * Returns null when inputs are incomplete or zero.
 */
function getCostPreview(
  unitQuantity: string,
  unit: string,
  unitPrice: string
): { costPerUnit: number; displayUnit: string } | null {
  let qty = parseFloat(unitQuantity);
  const price = parseFloat(unitPrice);
  if (!qty || !price || !unit || isNaN(qty) || isNaN(price)) return null;

  let displayUnit = unit.toLowerCase().trim();

  // Mirror normalizeToGrams so the preview matches what gets stored
  if (['kg', 'kilo', 'kilos'].includes(displayUnit)) {
    qty *= 1000;
    displayUnit = 'g';
  } else if (['lb', 'lbs', 'pound', 'pounds'].includes(displayUnit)) {
    qty *= 454;
    displayUnit = 'g';
  } else if (['oz', 'ounce', 'ounces'].includes(displayUnit)) {
    qty *= 28;
    displayUnit = 'g';
  } else if (['l', 'liter', 'litre', 'liters', 'litres'].includes(displayUnit)) {
    qty *= 1000;
    displayUnit = 'ml';
  } else if (['gram', 'grams'].includes(displayUnit)) {
    displayUnit = 'g';
  }

  return { costPerUnit: price / qty, displayUnit };
}

/** Format a small cost value with enough decimal places to be meaningful */
function formatCostPerUnit(cost: number): string {
  if (cost < 0.001) return `$${cost.toFixed(5)}`;
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 0.1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export default function InventoryManagement() {
  const { toast } = useToast();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState<InventoryItem | null>(null);
  const [inlineEditData, setInlineEditData] = useState<InventoryItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkSupplierId, setBulkSupplierId] = useState<string>("");
  const [portionCount, setPortionCount] = useState<string>("");
  const [portionUnit, setPortionUnit] = useState<string>("");
  const containerUnits: Record<string, string> = {
    'loaf': 'slice',
    'loaves': 'slice',
    'slab': 'slice',
    'slabs': 'slice',
    'box': 'piece',
    'boxes': 'piece',
    'pack': 'piece',
    'packs': 'piece',
    'packet': 'piece',
    'packets': 'piece',
    'bunch': 'stem',
    'bunches': 'stem',
    'tray': 'piece',
    'trays': 'piece',
    'roll': 'slice',
    'rolls': 'slice',
    'wheel': 'wedge',
    'wheels': 'wedge',
    'block': 'slice',
    'blocks': 'slice',
    'case': 'bottle',
    'cases': 'bottle',
    'ctn': 'piece',
    'carton': 'piece',
    'cartons': 'piece',
  };
  const isContainerUnit = (unit: string): boolean => {
    return unit.toLowerCase().trim() in containerUnits;
  };
  const getSuggestedPortionUnit = (unit: string): string => {
    return containerUnits[unit.toLowerCase().trim()] || 'piece';
  };
  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ["/admin/inventory-items"],
  });
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });
  // Sync formData with dialog state
  useEffect(() => {
    if (!isDialogOpen) {
      setFormData(null);
    }
  }, [isDialogOpen]);
  const updateMutation = useMutation({
    mutationFn: async (item: InventoryItem) => {
      return apiRequest("PUT", `/admin/inventory-items/${item.id}`, item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/inventory-items"] });
      toast({ title: "Item updated successfully" });
      setEditingItemId(null);
      setInlineEditData(null);
    },
    onError: () => {
      toast({
        title: "Error updating item",
        variant: "destructive"
      });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/admin/inventory-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/inventory-items"] });
      toast({ title: "Item deleted successfully" });
    },
    onError: () => {
      toast({
        title: "Error deleting item",
        variant: "destructive"
      });
    },
  });
  const createUnitConversionMutation = useMutation({
    mutationFn: async (conversion: { inventoryItemId: string; fromUnit: string; toUnit: string; conversionFactor: string }) => {
      return apiRequest("POST", "/api/unit-conversions", conversion);
    },
  });
  const createMutation = useMutation({
    mutationFn: async (item: Omit<InventoryItem, "id">) => {
      return apiRequest("POST", "/admin/inventory-items", item);
    },
    onSuccess: async (response) => {
      const newItem = await response.json();

      if (portionCount && portionUnit && formData) {
        try {
          await createUnitConversionMutation.mutateAsync({
            inventoryItemId: newItem.id,
            fromUnit: formData.unit,
            toUnit: portionUnit,
            conversionFactor: portionCount,
          });
        } catch (error) {
          console.error("Failed to create unit conversion:", error);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/admin/inventory-items"] });
      toast({ title: "Item created successfully" });
      setIsDialogOpen(false);
      setFormData(null);
      setPortionCount("");
      setPortionUnit("");
    },
    onError: () => {
      toast({
        title: "Error creating item",
        variant: "destructive"
      });
    },
  });
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Partial<InventoryItem> }) => {
      return apiRequest("POST", "/admin/inventory-items/bulk-update", { ids, updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/admin/inventory-items"] });
      toast({ title: `${selectedIds.size} items updated successfully` });
      setSelectedIds(new Set());
      setIsBulkEditOpen(false);
      setBulkSupplierId("");
    },
    onError: () => {
      toast({
        title: "Error updating items",
        variant: "destructive"
      });
    },
  });
  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (csvContent: string) => {
      const response = await fetch('/admin/inventory-items/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: csvContent
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/admin/inventory-items"] });
      toast({
        title: "Import completed",
        description: `Created: ${data.created}, Updated: ${data.updated}${data.errors?.length ? `, Errors: ${data.errors.length}` : ''}`
      });
      if (data.errors?.length) {
        console.log('Import errors:', data.errors);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });
  const handleExport = () => {
    window.location.href = '/admin/inventory-items/export';
  };
  const handleDownloadTemplate = () => {
    window.location.href = '/admin/inventory-items/template';
  };
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      importMutation.mutate(content);
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  // Calculate suggested default weight based on unit quantity and unit type
  const calculateDefaultWeight = (unitQuantity: string, unit: string): string => {
    const qty = parseFloat(unitQuantity) || 1;
    const unitLower = unit.toLowerCase().trim();

    // Convert to grams based on unit type
    if (unitLower === 'kg' || unitLower === 'kilo' || unitLower === 'kilos') {
      return String(Math.round(qty * 1000));
    }
    if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
      return String(Math.round(qty));
    }
    if (unitLower === 'lb' || unitLower === 'lbs' || unitLower === 'pound' || unitLower === 'pounds') {
      return String(Math.round(qty * 454)); // 1 lb ≈ 454g
    }
    if (unitLower === 'oz' || unitLower === 'ounce' || unitLower === 'ounces') {
      return String(Math.round(qty * 28)); // 1 oz ≈ 28g
    }
    // For boxes, bunches, each, etc. - use 5kg as default or qty * 1000 if qty > 1
    if (qty > 1) {
      return String(Math.round(qty * 1000));
    }
    return "5000"; // Default 5kg for boxes/bunches
  };
  // Normalize weight units to grams (e.g., 1kg -> 1000g)
  const normalizeToGrams = (item: InventoryItem): InventoryItem => {
    const qty = parseFloat(item.unitQuantity) || 1;
    const unitLower = item.unit.toLowerCase().trim();

    // Convert kg to g
    if (unitLower === 'kg' || unitLower === 'kilo' || unitLower === 'kilos') {
      return {
        ...item,
        unitQuantity: String(Math.round(qty * 1000)),
        unit: 'g'
      };
    }
    // Convert lb to g
    if (unitLower === 'lb' || unitLower === 'lbs' || unitLower === 'pound' || unitLower === 'pounds') {
      return {
        ...item,
        unitQuantity: String(Math.round(qty * 454)),
        unit: 'g'
      };
    }
    // Convert oz to g
    if (unitLower === 'oz' || unitLower === 'ounce' || unitLower === 'ounces') {
      return {
        ...item,
        unitQuantity: String(Math.round(qty * 28)),
        unit: 'g'
      };
    }
    // Convert L to ml
    if (unitLower === 'l' || unitLower === 'liter' || unitLower === 'litre' || unitLower === 'liters' || unitLower === 'litres') {
      return {
        ...item,
        unitQuantity: String(Math.round(qty * 1000)),
        unit: 'ml'
      };
    }
    // Standardize gram spelling
    if (unitLower === 'gram' || unitLower === 'grams') {
      return { ...item, unit: 'g' };
    }

    return item;
  };
  const handleRowClick = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setInlineEditData({ ...item });
  };
  const handleCreate = () => {
    setFormData({
      id: "",
      name: "",
      unitQuantity: "1",
      unit: "g",
      unitPrice: "0",
      variableWeight: false,
      defaultWeight: "",
      portionsPerUnit: "",
      proteinPer100g: "",
      carbsPer100g: "",
      fatPer100g: "",
      caloriesPer100g: "",
      notes: "",
      supplierId: null,
    });
    setPortionCount("");
    setPortionUnit("");
    setIsDialogOpen(true);
  };
  const handleSaveInline = () => {
    if (!inlineEditData) return;
    // Normalize units to grams before saving
    const normalizedData = normalizeToGrams(inlineEditData);
    // Validate variable weight items have default weight
    if (normalizedData.variableWeight && (!normalizedData.defaultWeight || normalizedData.defaultWeight.trim() === '')) {
      toast({
        title: "Default weight required",
        description: "Variable weight items must have a default weight in grams for costing",
        variant: "destructive"
      });
      return;
    }
    updateMutation.mutate(normalizedData);
  };
  const handleCancelInline = () => {
    setEditingItemId(null);
    setInlineEditData(null);
  };
  const handleSaveDialog = () => {
    if (!formData) return;
    // Normalize units to grams before saving
    const normalizedData = normalizeToGrams(formData);
    // Validate variable weight items have default weight
    if (normalizedData.variableWeight && (!normalizedData.defaultWeight || normalizedData.defaultWeight.trim() === '')) {
      toast({
        title: "Default weight required",
        description: "Variable weight items must have a default weight in grams for costing",
        variant: "destructive"
      });
      return;
    }
    const { id, ...itemWithoutId } = normalizedData;
    createMutation.mutate(itemWithoutId);
  };
  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteMutation.mutate(id);
    }
  };
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(item => item.id)));
    }
  };
  const handleBulkUpdateSupplier = () => {
    if (selectedIds.size === 0) return;
    const updates: Partial<InventoryItem> = {
      supplierId: bulkSupplierId === "__none__" ? null : bulkSupplierId || null,
    };
    bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates });
  };
  const getSupplierName = (supplierId: string | null): string => {
    if (!supplierId) return "-";
    const supplier = suppliers.find(s => s.id === supplierId);
    return supplier?.name || "-";
  };
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-8">
        <div className="max-w-7xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-home">
                <Home className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Inventory Management</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/staging-inventory">
              <Button variant="outline" data-testid="button-staging-inventory">
                Staging Inventory
              </Button>
            </Link>
            <Button variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button variant="outline" onClick={handleExport} data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                data-testid="input-import-file"
              />
              <Button variant="outline" asChild disabled={importMutation.isPending}>
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  {importMutation.isPending ? 'Importing...' : 'Import'}
                </span>
              </Button>
            </label>
            <Button onClick={handleCreate} data-testid="button-create-item">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <Input
            placeholder="Search inventory items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
            data-testid="input-search"
          />
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsBulkEditOpen(true)}
              data-testid="button-bulk-edit"
            >
              <Users className="w-4 h-4 mr-2" />
              Bulk Edit ({selectedIds.size})
            </Button>
          )}
        </div>
        <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="px-2 py-3 text-center">
                    <Checkbox
                      checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Variable Weight
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Default Weight (g)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Portions
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    P
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    C
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    F
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredItems.map((item) => {
                  const isEditing = editingItemId === item.id;
                  if (isEditing && inlineEditData) {
                    // Compute live cost preview for inline edit
                    const inlinePreview = getCostPreview(
                      inlineEditData.unitQuantity,
                      inlineEditData.unit,
                      inlineEditData.unitPrice
                    );
                    return (
                      <tr
                        key={item.id}
                        className="bg-blue-50 dark:bg-blue-950"
                        data-testid={`row-item-${item.id}`}
                      >
                        <td className="px-2 py-3 text-center">
                          <Checkbox
                            checked={selectedIds.has(item.id)}
                            onCheckedChange={() => toggleSelection(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-select-${item.id}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={inlineEditData.name}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, name: e.target.value })}
                            className="h-8"
                            data-testid="input-name"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={inlineEditData.supplierId || "__none__"}
                            onValueChange={(value) => setInlineEditData({ ...inlineEditData, supplierId: value === "__none__" ? null : value })}
                          >
                            <SelectTrigger className="h-8 w-32" data-testid="select-supplier">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {suppliers.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <Input
                              value={inlineEditData.unitQuantity}
                              onChange={(e) => setInlineEditData({ ...inlineEditData, unitQuantity: e.target.value })}
                              className="h-8 w-16"
                              data-testid="input-unit-quantity"
                            />
                            <Input
                              value={inlineEditData.unit}
                              onChange={(e) => setInlineEditData({ ...inlineEditData, unit: e.target.value })}
                              className="h-8 w-16"
                              data-testid="input-unit"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={inlineEditData.unitPrice}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, unitPrice: e.target.value })}
                            className="h-8 w-24"
                            data-testid="input-unit-price"
                          />
                          {inlinePreview && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 whitespace-nowrap">
                              {formatCostPerUnit(inlinePreview.costPerUnit)}/{inlinePreview.displayUnit}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={inlineEditData.variableWeight}
                            onCheckedChange={(checked) => {
                              const isVariable = checked === true;
                              const suggestedWeight = isVariable && !inlineEditData.defaultWeight
                                ? calculateDefaultWeight(inlineEditData.unitQuantity, inlineEditData.unit)
                                : inlineEditData.defaultWeight;
                              setInlineEditData({
                                ...inlineEditData,
                                variableWeight: isVariable,
                                defaultWeight: suggestedWeight
                              });
                            }}
                            data-testid="checkbox-variable-weight"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={inlineEditData.defaultWeight}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, defaultWeight: e.target.value })}
                            className="h-8 w-24"
                            placeholder={inlineEditData.variableWeight ? "Required" : ""}
                            data-testid="input-default-weight"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            value={inlineEditData.portionsPerUnit || ""}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, portionsPerUnit: e.target.value })}
                            className="h-8 w-16"
                            placeholder="-"
                            data-testid="input-portions-inline"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={inlineEditData.proteinPer100g || ""}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, proteinPer100g: e.target.value })}
                            className="h-8 w-14 text-center"
                            placeholder="P"
                            data-testid="input-protein-inline"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={inlineEditData.carbsPer100g || ""}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, carbsPer100g: e.target.value })}
                            className="h-8 w-14 text-center"
                            placeholder="C"
                            data-testid="input-carbs-inline"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="0.1"
                            value={inlineEditData.fatPer100g || ""}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, fatPer100g: e.target.value })}
                            className="h-8 w-14 text-center"
                            placeholder="F"
                            data-testid="input-fat-inline"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            step="1"
                            value={inlineEditData.caloriesPer100g || ""}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, caloriesPer100g: e.target.value })}
                            className="h-8 w-14 text-center"
                            placeholder="Cal"
                            data-testid="input-calories-inline"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            value={inlineEditData.notes}
                            onChange={(e) => setInlineEditData({ ...inlineEditData, notes: e.target.value })}
                            className="h-8"
                            data-testid="input-notes"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleSaveInline}
                              data-testid="button-save-inline"
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelInline}
                              data-testid="button-cancel-inline"
                            >
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  // Compute cost preview for read-only row
                  const rowPreview = getCostPreview(item.unitQuantity, item.unit, item.unitPrice);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
                      onClick={() => handleRowClick(item)}
                      data-testid={`row-item-${item.id}`}
                    >
                      <td className="px-2 py-3 text-center">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-select-${item.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm" data-testid={`text-name-${item.id}`}>
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {getSupplierName(item.supplierId)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.unitQuantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>${item.unitPrice}</div>
                        {rowPreview && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {formatCostPerUnit(rowPreview.costPerUnit)}/{rowPreview.displayUnit}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.variableWeight ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {item.defaultWeight || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {(item as any).portionsPerUnit || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {item.proteinPer100g || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {item.carbsPer100g || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {item.fatPer100g || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                        {item.caloriesPer100g || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {item.notes || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              {searchTerm ? "No items found matching your search" : "No inventory items yet"}
            </div>
          )}
        </div>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {formData?.id ? "Edit Inventory Item" : "Create Inventory Item"}
            </DialogTitle>
          </DialogHeader>
          {formData && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="unitQuantity">Unit Quantity</Label>
                  <Input
                    id="unitQuantity"
                    value={formData.unitQuantity}
                    onChange={(e) => setFormData({ ...formData, unitQuantity: e.target.value })}
                    data-testid="input-unit-quantity"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setFormData({ ...formData, unit: newUnit });
                      if (isContainerUnit(newUnit)) {
                        setPortionUnit(getSuggestedPortionUnit(newUnit));
                      } else {
                        setPortionUnit("");
                        setPortionCount("");
                      }
                    }}
                    placeholder="g, ml, ea, kg, case, box"
                    data-testid="input-unit"
                  />
                </div>
              </div>
              {isContainerUnit(formData.unit) && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                    How many <strong>{portionUnit || getSuggestedPortionUnit(formData.unit)}s</strong> are in 1 {formData.unit}?
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="portionCount" className="text-xs">Number of portions</Label>
                      <Input
                        id="portionCount"
                        type="number"
                        value={portionCount}
                        onChange={(e) => setPortionCount(e.target.value)}
                        placeholder="e.g., 16"
                        data-testid="input-portion-count"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="portionUnit" className="text-xs">Portion unit name</Label>
                      <Input
                        id="portionUnit"
                        value={portionUnit}
                        onChange={(e) => setPortionUnit(e.target.value)}
                        placeholder="e.g., slice, piece"
                        data-testid="input-portion-unit"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    This helps calculate costs when recipes use {portionUnit || getSuggestedPortionUnit(formData.unit)}s instead of {formData.unit}s
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="unitPrice">Unit Price ($)</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    step="0.01"
                    value={formData.unitPrice}
                    onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                    data-testid="input-unit-price"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select
                    value={formData.supplierId || "__none__"}
                    onValueChange={(value) => setFormData({ ...formData, supplierId: value === "__none__" ? null : value })}
                  >
                    <SelectTrigger data-testid="select-create-supplier">
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {suppliers.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Live cost preview — updates as user types price, quantity, or unit */}
              {(() => {
                const preview = getCostPreview(formData.unitQuantity, formData.unit, formData.unitPrice);
                if (!preview) return null;
                const rawUnit = formData.unit.toLowerCase().trim();
                const isNormalised = preview.displayUnit !== rawUnit;
                return (
                  <div
                    className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3"
                    data-testid="cost-preview"
                  >
                    <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                      Cost per {preview.displayUnit}: {formatCostPerUnit(preview.costPerUnit)}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                      ${parseFloat(formData.unitPrice).toFixed(2)} ÷ {formData.unitQuantity}
                      {isNormalised
                        ? ` ${formData.unit} (stored as ${Math.round(parseFloat(formData.unitQuantity) * (preview.costPerUnit === 0 ? 1 : parseFloat(formData.unitPrice) / preview.costPerUnit))}${preview.displayUnit})`
                        : ` ${preview.displayUnit}`}
                    </p>
                  </div>
                );
              })()}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="variableWeight"
                  checked={formData.variableWeight}
                  onCheckedChange={(checked) => {
                    const isVariable = checked === true;
                    const suggestedWeight = isVariable && !formData.defaultWeight
                      ? calculateDefaultWeight(formData.unitQuantity, formData.unit)
                      : formData.defaultWeight;
                    setFormData({
                      ...formData,
                      variableWeight: isVariable,
                      defaultWeight: suggestedWeight
                    });
                  }}
                  data-testid="checkbox-variable-weight"
                />
                <Label htmlFor="variableWeight">
                  Variable Weight (boxes/bunches with different weights)
                </Label>
              </div>
              {formData.variableWeight && (
                <div className="grid gap-2">
                  <Label htmlFor="defaultWeight">Default Weight (grams) *</Label>
                  <Input
                    id="defaultWeight"
                    type="number"
                    value={formData.defaultWeight}
                    onChange={(e) => setFormData({ ...formData, defaultWeight: e.target.value })}
                    placeholder="e.g., 5000 for 5kg box"
                    data-testid="input-default-weight"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enter typical weight in grams for costing calculations (required)
                  </p>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="portionsPerUnit">Portions Per Unit (optional)</Label>
                <Input
                  id="portionsPerUnit"
                  type="number"
                  value={formData.portionsPerUnit}
                  onChange={(e) => setFormData({ ...formData, portionsPerUnit: e.target.value })}
                  placeholder="e.g., 6 for a slab that yields 6 pieces"
                  data-testid="input-portions-per-unit"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  How many servable portions from one unit (e.g., 6 slices from a focaccia slab)
                </p>
              </div>
              <div className="border-t pt-4 mt-2">
                <Label className="text-sm font-medium mb-3 block">Nutrition per 100g (optional)</Label>
                <div className="grid grid-cols-4 gap-3">
                  <div className="grid gap-1">
                    <Label htmlFor="protein" className="text-xs text-gray-500">Protein (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      step="0.1"
                      value={formData.proteinPer100g}
                      onChange={(e) => setFormData({ ...formData, proteinPer100g: e.target.value })}
                      placeholder="0"
                      data-testid="input-protein"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="carbs" className="text-xs text-gray-500">Carbs (g)</Label>
                    <Input
                      id="carbs"
                      type="number"
                      step="0.1"
                      value={formData.carbsPer100g}
                      onChange={(e) => setFormData({ ...formData, carbsPer100g: e.target.value })}
                      placeholder="0"
                      data-testid="input-carbs"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="fat" className="text-xs text-gray-500">Fat (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      step="0.1"
                      value={formData.fatPer100g}
                      onChange={(e) => setFormData({ ...formData, fatPer100g: e.target.value })}
                      placeholder="0"
                      data-testid="input-fat"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="calories" className="text-xs text-gray-500">Calories</Label>
                    <Input
                      id="calories"
                      type="number"
                      step="1"
                      value={formData.caloriesPer100g}
                      onChange={(e) => setFormData({ ...formData, caloriesPer100g: e.target.value })}
                      placeholder="0"
                      data-testid="input-calories"
                    />
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional info..."
                  data-testid="input-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setFormData(null);
              }}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveDialog}
              disabled={createMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit {selectedIds.size} Items</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Set Supplier</Label>
                <Select
                  value={bulkSupplierId}
                  onValueChange={setBulkSupplierId}
                >
                  <SelectTrigger data-testid="select-bulk-supplier">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No supplier (clear)</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  This will update the supplier for all {selectedIds.size} selected items.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkEditOpen(false);
                setBulkSupplierId("");
              }}
              data-testid="button-bulk-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkUpdateSupplier}
              disabled={bulkUpdateMutation.isPending || !bulkSupplierId}
              data-testid="button-bulk-apply"
            >
              {bulkUpdateMutation.isPending ? "Updating..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
