import { sql } from "drizzle-orm";
import { pgTable, text, varchar, json, integer, boolean, numeric, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
export const expenseCategories = ["kitchen", "bar", "packaging", "general/cleaning"] as const;
export type ExpenseCategory = typeof expenseCategories[number];
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // coffee, smoothies, grabgo, breakfast, sandwiches, bowls, salads, sauces, prep
  isPrep: boolean("is_prep").notNull().default(false), // Mark if this is a prep component
  isFinishedMenuItem: boolean("is_finished_menu_item").notNull().default(false), // Mark if this is a finished menu item for sale
  archived: boolean("archived").notNull().default(false), // Mark if this recipe is archived
  servings: text("servings").default(""),
  yieldPercent: text("yield_percent").default("100"), // Yield percentage after cooking (e.g., "70" means 70% yield, 30% lost)
  yieldWeight: text("yield_weight").default(""), // Total finished product weight in grams (for prep recipes used as components)
  retailPrice: text("retail_price").default(""), // Selling price for COGS calculation
  hiddenFromDashboard: boolean("hidden_from_dashboard").notNull().default(false), // Hide from cost dashboard
  proteinPerServing: text("protein_per_serving").default(""), // Manual override for protein per serving (grams)
  carbsPerServing: text("carbs_per_serving").default(""), // Manual override for carbs per serving (grams)
  fatPerServing: text("fat_per_serving").default(""), // Manual override for fat per serving (grams)
  caloriesPerServing: text("calories_per_serving").default(""), // Manual override for calories per serving
  ingredients: json("ingredients").$type<Array<{
    amount: string;
    unit: string;
    name: string;
    modifier?: string;
  }>>().notNull().default([]),
  steps: json("steps").$type<Array<string>>().notNull().default([]),
  tips: text("tips").default(""),
  images: json("images").$type<Array<string>>().notNull().default([]),
  linkedRecipeIds: text("linked_recipe_ids").array().notNull().default([]), // IDs of related recipes (e.g., dressings for salads)
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  value: text("value").notNull().unique(),
  label: text("label").notNull(),
  icon: text("icon").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export const prepItems = pgTable("prep_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dish: text("dish").notNull(),
  item: text("item").notNull(),
  category: text("category").notNull(),
  parLevelRaw: text("par_level_raw").notNull(),
  prepDays: text("prep_days").array().notNull().default([]),
  prepDaysRaw: text("prep_days_raw").notNull(),
  notes: text("notes").default(""),
  recipeId: varchar("recipe_id"),
  completed: boolean("completed").notNull().default(false),
  recurring: boolean("recurring").notNull().default(false),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const orderListItems = pgTable("order_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // pantry, meats, dairy, fruit-veg, etc.
  unitSize: text("unit_size").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unitQuantity: text("unit_quantity").notNull(), // e.g., "1000" for 1kg bag
  unit: text("unit").notNull(), // e.g., "g", "ml", "each"
  unitPrice: text("unit_price").notNull(), // price as text to avoid decimal precision issues
  variableWeight: boolean("variable_weight").default(false), // true for boxes/bunches that need weight input
  defaultWeight: text("default_weight").default(""), // default weight in grams for variable weight items
  portionsPerUnit: text("portions_per_unit").default(""), // number of servable portions from one unit
  proteinPer100g: text("protein_per_100g").default(""), // protein in grams per 100g
  carbsPer100g: text("carbs_per_100g").default(""), // carbohydrates in grams per 100g
  fatPer100g: text("fat_per_100g").default(""), // fat in grams per 100g
  caloriesPer100g: text("calories_per_100g").default(""), // calories per 100g
  notes: text("notes").default(""),
  supplierId: varchar("supplier_id").references(() => suppliers.id, { onDelete: "set null" }), // optional FK to suppliers table
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const stagingInventoryItems = pgTable("staging_inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  unitQuantity: text("unit_quantity").notNull(),
  unit: text("unit").notNull(),
  unitPrice: text("unit_price").notNull(),
  variableWeight: boolean("variable_weight").default(false),
  defaultWeight: text("default_weight").default(""),
  portionsPerUnit: text("portions_per_unit").default(""),
  proteinPer100g: text("protein_per_100g").default(""),
  carbsPer100g: text("carbs_per_100g").default(""),
  fatPer100g: text("fat_per_100g").default(""),
  caloriesPer100g: text("calories_per_100g").default(""),
  notes: text("notes").default(""),
  supplierId: varchar("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // free-text ingredient name
  quantity: text("quantity").notNull(), // quantity as text (can include fractions like "½", "1/4", etc.)
  unit: text("unit").notNull(), // e.g., "g", "ml", "cups", "tsp"
  modifier: text("modifier").default(""), // e.g., "toasted", "crushed", "finely chopped"
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id, { onDelete: "set null" }), // nullable FK to link to inventory
  prepRecipeId: varchar("prep_recipe_id").references(() => recipes.id, { onDelete: "set null" }), // nullable FK to link to prep recipe (when ingredient is a prep item)
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateRecipeSchema = insertRecipeSchema.partial();
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});
export const updateCategorySchema = insertCategorySchema.partial();
export const insertPrepItemSchema = createInsertSchema(prepItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).refine(
  (data) => {
    if (!data.prepDays) return false;
    const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    return data.prepDays.every(day => validDays.includes(day));
  },
  {
    message: "prepDays can only include weekdays: Mon, Tue, Wed, Thu, Fri",
    path: ["prepDays"],
  }
).refine(
  (data) => data.prepDays && data.prepDays.length > 0,
  {
    message: "prepDays must include at least one day",
    path: ["prepDays"],
  }
);
export const updatePrepItemSchema = createInsertSchema(prepItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).partial().refine(
  (data) => {
    if (!data.prepDays) return true;
    const validDays = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    return data.prepDays.every(day => validDays.includes(day));
  },
  {
    message: "prepDays can only include weekdays: Mon, Tue, Wed, Thu, Fri",
    path: ["prepDays"],
  }
).refine(
  (data) => {
    if (!data.prepDays) return true;
    return data.prepDays.length > 0;
  },
  {
    message: "prepDays must include at least one day",
    path: ["prepDays"],
  }
);
export const insertOrderListItemSchema = createInsertSchema(orderListItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateOrderListItemSchema = insertOrderListItemSchema.partial();
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateInventoryItemSchema = insertInventoryItemSchema.partial();
export const insertStagingInventoryItemSchema = createInsertSchema(stagingInventoryItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateStagingInventoryItemSchema = insertStagingInventoryItemSchema.partial();
export const insertRecipeIngredientSchema = createInsertSchema(recipeIngredients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateRecipeIngredientSchema = insertRecipeIngredientSchema.partial();
export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplier: text("supplier").notNull(),
  category: text("category").notNull(), // kitchen, bar, packaging, general/cleaning
  amount: text("amount").notNull(), // stored as text to avoid precision issues
  date: timestamp("date").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export const budgetSettings = pgTable("budget_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  weeklyBudget: text("weekly_budget").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  usageCount: integer("usage_count").notNull().default(1),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export const categoryBudgets = pgTable("category_budgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull().unique(), // kitchen, bar, packaging, general/cleaning
  weeklyBudget: text("weekly_budget").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
const positiveDecimalRegex = /^\d+(\.\d{1,2})?$/;
export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
}).extend({
  supplier: z.string().min(1, "Supplier is required").max(200, "Supplier name too long"),
  amount: z.string().regex(positiveDecimalRegex, "Amount must be a valid positive number (e.g., 123.45)").refine(
    (val) => parseFloat(val) > 0,
    "Amount must be greater than 0"
  ),
  category: z.enum(expenseCategories, { required_error: "Category is required" }),
});
export const updateExpenseSchema = insertExpenseSchema.partial();
export const insertBudgetSettingsSchema = createInsertSchema(budgetSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  weeklyBudget: z.string().regex(positiveDecimalRegex, "Budget must be a valid positive number").refine(
    (val) => parseFloat(val) >= 0,
    "Budget must be 0 or greater"
  ),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Supplier name is required").max(200, "Supplier name too long"),
});
export const insertCategoryBudgetSchema = createInsertSchema(categoryBudgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  category: z.enum(expenseCategories, { required_error: "Category is required" }),
  weeklyBudget: z.string().regex(positiveDecimalRegex, "Budget must be a valid positive number").refine(
    (val) => parseFloat(val) >= 0,
    "Budget must be 0 or greater"
  ),
});
export const scannedInvoiceStatuses = ["processing", "ready", "committed", "failed"] as const;
export type ScannedInvoiceStatus = typeof scannedInvoiceStatuses[number];
// Pending emails that need review before processing
export const pendingEmailStatuses = ["pending", "accepted", "rejected"] as const;
export type PendingEmailStatus = typeof pendingEmailStatuses[number];
export const pendingEmails = pgTable("pending_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromEmail: text("from_email").notNull(),
  subject: text("subject").default(""),
  attachmentCount: integer("attachment_count").default(0),
  rawEmailData: json("raw_email_data").$type<any>().default(null),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export const insertPendingEmailSchema = createInsertSchema(pendingEmails).omit({
  id: true,
  createdAt: true,
});
export const updatePendingEmailSchema = insertPendingEmailSchema.partial();
export const scannedInvoices = pgTable("scanned_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageUrl: text("image_url").notNull(),
  supplierName: text("supplier_name").default(""),
  invoiceDate: timestamp("invoice_date"),
  subtotal: text("subtotal").default(""),
  tax: text("tax").default(""),
  total: text("total").default(""),
  status: text("status").notNull().default("processing"),
  rawVisionJson: json("raw_vision_json").$type<any>().default(null),
  sourceExpenseId: varchar("source_expense_id").references(() => expenses.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export const scannedInvoiceItems = pgTable("scanned_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scannedInvoiceId: varchar("scanned_invoice_id").notNull().references(() => scannedInvoices.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull().default(0),
  description: text("description").notNull(),
  quantity: text("quantity").default("1"),
  weight: text("weight").default(""), // Weight/size info like "15kg", "1.5kg", "200g"
  unitType: text("unit_type").default(""), // Unit type like "CTN", "EA", "BOX", "BUNCH"
  unitPrice: text("unit_price").default(""),
  totalPrice: text("total_price").default(""),
  taxCode: text("tax_code").default(""), // FRE, GST, etc.
  inferredCategory: text("inferred_category").default(""),
  possibleInventoryMatchId: varchar("possible_inventory_match_id").references(() => inventoryItems.id, { onDelete: "set null" }),
  linkedInventoryItemId: varchar("linked_inventory_item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export const supplierPrices = pgTable("supplier_prices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  supplierName: text("supplier_name").notNull(),
  itemName: text("item_name").notNull(),
  unitSize: text("unit_size").default(""),
  unitPriceExGst: text("unit_price_ex_gst").notNull(),
  unitPriceIncGst: text("unit_price_inc_gst").default(""),
  taxCode: text("tax_code").default("GST"),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id, { onDelete: "set null" }),
  scannedInvoiceId: varchar("scanned_invoice_id").references(() => scannedInvoices.id, { onDelete: "set null" }),
  effectiveDate: timestamp("effective_date").notNull().default(sql`CURRENT_TIMESTAMP`),
  isLatest: boolean("is_latest").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});
export const insertScannedInvoiceSchema = createInsertSchema(scannedInvoices).omit({
  id: true,
  createdAt: true,
});
export const updateScannedInvoiceSchema = insertScannedInvoiceSchema.partial();
export const insertScannedInvoiceItemSchema = createInsertSchema(scannedInvoiceItems).omit({
  id: true,
  createdAt: true,
});
export const updateScannedInvoiceItemSchema = insertScannedInvoiceItemSchema.partial();
export const insertSupplierPriceSchema = createInsertSchema(supplierPrices).omit({
  id: true,
  createdAt: true,
});
export const updateSupplierPriceSchema = insertSupplierPriceSchema.partial();
// Unit conversions for when recipe unit doesn't match inventory unit
// e.g., "1 Unit of HAM LEG = 500 g"
export const unitConversions = pgTable("unit_conversions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inventoryItemId: varchar("inventory_item_id").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
  fromUnit: text("from_unit").notNull(), // The inventory's native unit (e.g., "unit", "each", "pack")
  toUnit: text("to_unit").notNull(), // The recipe's requested unit (e.g., "g", "ml", "kg")
  conversionFactor: text("conversion_factor").notNull(), // How many toUnits in 1 fromUnit (e.g., "500" means 1 unit = 500g)
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`),
});
export const insertUnitConversionSchema = createInsertSchema(unitConversions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const updateUnitConversionSchema = insertUnitConversionSchema.partial();
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type UpdateRecipe = z.infer<typeof updateRecipeSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type UpdateCategory = z.infer<typeof updateCategorySchema>;
export type PrepItem = typeof prepItems.$inferSelect;
export type InsertPrepItem = z.infer<typeof insertPrepItemSchema>;
export type UpdatePrepItem = z.infer<typeof updatePrepItemSchema>;
export type OrderListItem = typeof orderListItems.$inferSelect;
export type InsertOrderListItem = z.infer<typeof insertOrderListItemSchema>;
export type UpdateOrderListItem = z.infer<typeof updateOrderListItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type UpdateInventoryItem = z.infer<typeof updateInventoryItemSchema>;
export type StagingInventoryItem = typeof stagingInventoryItems.$inferSelect;
export type InsertStagingInventoryItem = z.infer<typeof insertStagingInventoryItemSchema>;
export type UpdateStagingInventoryItem = z.infer<typeof updateStagingInventoryItemSchema>;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type InsertRecipeIngredient = z.infer<typeof insertRecipeIngredientSchema>;
export type UpdateRecipeIngredient = z.infer<typeof updateRecipeIngredientSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type UpdateExpense = z.infer<typeof updateExpenseSchema>;
export type BudgetSettings = typeof budgetSettings.$inferSelect;
export type InsertBudgetSettings = z.infer<typeof insertBudgetSettingsSchema>;
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type CategoryBudget = typeof categoryBudgets.$inferSelect;
export type InsertCategoryBudget = z.infer<typeof insertCategoryBudgetSchema>;
export type ScannedInvoice = typeof scannedInvoices.$inferSelect;
export type InsertScannedInvoice = z.infer<typeof insertScannedInvoiceSchema>;
export type UpdateScannedInvoice = z.infer<typeof updateScannedInvoiceSchema>;
export type ScannedInvoiceItem = typeof scannedInvoiceItems.$inferSelect;
export type InsertScannedInvoiceItem = z.infer<typeof insertScannedInvoiceItemSchema>;
export type UpdateScannedInvoiceItem = z.infer<typeof updateScannedInvoiceItemSchema>;
export type SupplierPrice = typeof supplierPrices.$inferSelect;
export type InsertSupplierPrice = z.infer<typeof insertSupplierPriceSchema>;
export type UpdateSupplierPrice = z.infer<typeof updateSupplierPriceSchema>;
export type UnitConversion = typeof unitConversions.$inferSelect;
export type InsertUnitConversion = z.infer<typeof insertUnitConversionSchema>;
export type UpdateUnitConversion = z.infer<typeof updateUnitConversionSchema>;
export type PendingEmail = typeof pendingEmails.$inferSelect;
export type InsertPendingEmail = z.infer<typeof insertPendingEmailSchema>;
export type UpdatePendingEmail = z.infer<typeof updatePendingEmailSchema>;
export const ordSuppliers = pgTable("ord_suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").default(""),
  ccEmail: text("cc_email").default(""),
  orderLink: text("order_link").default(""),
  active: boolean("active").notNull().default(true),
  notes: text("notes").default(""),
  deliveryDays: text("delivery_days").array().notNull().default([]),
});
export const ordItems = pgTable("ord_items", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => ordSuppliers.id, { onDelete: "cascade" }),
  category: text("category").default(""),
  name: text("name").notNull(),
  code: text("code").default(""),
  unit: text("unit").default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
});
export const ordOrders = pgTable("ord_orders", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull().references(() => ordSuppliers.id, { onDelete: "cascade" }),
  deliveryDate: timestamp("delivery_date"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  createdBy: text("created_by").default(""),
  notes: text("notes").default(""),
  status: text("status").notNull().default("submitted"),
});
export const ordOrderItems = pgTable("ord_order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordOrders.id, { onDelete: "cascade" }),
  itemId: integer("item_id").notNull().references(() => ordItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(0),
});
export const insertOrdSupplierSchema = createInsertSchema(ordSuppliers).omit({ id: true });
export const updateOrdSupplierSchema = insertOrdSupplierSchema.partial();
export const insertOrdItemSchema = createInsertSchema(ordItems).omit({ id: true });
export const updateOrdItemSchema = insertOrdItemSchema.partial();
export const insertOrdOrderSchema = createInsertSchema(ordOrders).omit({ id: true, createdAt: true });
export const updateOrdOrderSchema = insertOrdOrderSchema.partial();
export const insertOrdOrderItemSchema = createInsertSchema(ordOrderItems).omit({ id: true });
export type OrdSupplier = typeof ordSuppliers.$inferSelect;
export type InsertOrdSupplier = z.infer<typeof insertOrdSupplierSchema>;
export type UpdateOrdSupplier = z.infer<typeof updateOrdSupplierSchema>;
export type OrdItem = typeof ordItems.$inferSelect;
export type InsertOrdItem = z.infer<typeof insertOrdItemSchema>;
export type UpdateOrdItem = z.infer<typeof updateOrdItemSchema>;
export type OrdOrder = typeof ordOrders.$inferSelect;
export type InsertOrdOrder = z.infer<typeof insertOrdOrderSchema>;
export type UpdateOrdOrder = z.infer<typeof updateOrdOrderSchema>;
export type OrdOrderItem = typeof ordOrderItems.$inferSelect;
export type InsertOrdOrderItem = z.infer<typeof insertOrdOrderItemSchema>;
export type RecipeCategory = "coffee" | "smoothies" | "grabgo" | "breakfast" | "sandwiches" | "bowls" | "salads" | "sauces" | "prep";
export const RECIPE_CATEGORIES: { value: RecipeCategory; label: string; icon: string }[] = [
  { value: "coffee", label: "Coffee/Drinks", icon: "fas fa-coffee" },
  { value: "smoothies", label: "Smoothies", icon: "fas fa-blender" },
  { value: "grabgo", label: "Grab & Go", icon: "fas fa-shopping-bag" },
  { value: "breakfast", label: "Breakfast", icon: "fas fa-egg" },
  { value: "sandwiches", label: "Sandwiches", icon: "fas fa-hamburger" },
  { value: "bowls", label: "Bowls", icon: "fas fa-bowl-food" },
  { value: "salads", label: "Salads", icon: "fas fa-leaf" },
  { value: "sauces", label: "Sauces", icon: "fas fa-bottle-droplet" },
  { value: "prep", label: "Prep", icon: "fas fa-clipboard-list" },
];
