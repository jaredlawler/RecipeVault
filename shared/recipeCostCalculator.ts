/**
 * Recipe Cost Calculator
 *
 * Helper functions to calculate the cost of a recipe based on linked inventory items.
 * This module provides utilities for computing recipe costs using ingredient quantities
 * and their linked inventory pricing, including unit mismatch detection and conversion support.
 */
export type RecipeIngredientWithInventory = {
  quantity: string; // e.g., "200", "½", "1/4"
  unit: string; // e.g., "g", "ml", "cups"
  inventoryItem: {
    id: string;
    name: string;
    unitQuantity: string; // e.g., "1000" for 1kg
    unit: string; // e.g., "g", "ml"
    unitPrice: string; // e.g., "15.00"
  };
};
export type UnitConversion = {
  id: string;
  inventoryItemId: string;
  fromUnit: string;
  toUnit: string;
  conversionFactor: string;
};
export type UnitMismatchWarning = {
  ingredientName: string;
  recipeUnit: string;
  inventoryUnit: string;
  inventoryItemId: string;
  inventoryItemName: string;
  canConvert: boolean;
  conversion?: UnitConversion;
};
export type CostCalculationResult = {
  cost: number;
  hasUnitMismatch: boolean;
  usedConversion?: UnitConversion;
};
const UNIT_ALIASES: Record<string, string[]> = {
  'g': ['g', 'gr', 'gram', 'grams', 'gm'],
  'kg': ['kg', 'kilo', 'kilogram', 'kilograms'],
  'ml': ['ml', 'milliliter', 'millilitre', 'milliliters', 'millilitres'],
  'l': ['l', 'liter', 'litre', 'liters', 'litres'],
  'unit': ['unit', 'units', 'ea', 'each', 'piece', 'pieces', 'pc', 'pcs'],
  'cup': ['cup', 'cups', 'c'],
  'tbsp': ['tbsp', 'tablespoon', 'tablespoons', 'tbs'],
  'tsp': ['tsp', 'teaspoon', 'teaspoons'],
  'oz': ['oz', 'ounce', 'ounces'],
  'lb': ['lb', 'lbs', 'pound', 'pounds'],
  'bunch': ['bunch', 'bunches'],
  'head': ['head', 'heads'],
  'clove': ['clove', 'cloves'],
  'can': ['can', 'cans', 'tin', 'tins'],
  'bottle': ['bottle', 'bottles'],
  'jar': ['jar', 'jars'],
  'pack': ['pack', 'packs', 'packet', 'packets'],
  'box': ['box', 'boxes'],
  'bag': ['bag', 'bags'],
  'slice': ['slice', 'slices'],
};
const STANDARD_CONVERSIONS: Record<string, Record<string, number>> = {
  'g': { 'kg': 0.001, 'oz': 0.03527 },
  'kg': { 'g': 1000, 'lb': 2.20462 },
  'ml': { 'l': 0.001, 'cup': 0.00423 },
  'l': { 'ml': 1000, 'cup': 4.227 },
  'oz': { 'g': 28.3495, 'lb': 0.0625 },
  'lb': { 'oz': 16, 'kg': 0.453592, 'g': 453.592 },
  'cup': { 'ml': 236.588, 'l': 0.236588 },
  'tbsp': { 'tsp': 3, 'ml': 14.787 },
  'tsp': { 'tbsp': 0.333, 'ml': 4.929 },
};
/**
 * Normalize a unit string to its canonical form
 */
export function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
    if (aliases.includes(lower)) {
      return canonical;
    }
  }
  return lower;
}
/**
 * Check if two units are compatible (same or convertible)
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  const norm1 = normalizeUnit(unit1);
  const norm2 = normalizeUnit(unit2);

  if (norm1 === norm2) return true;

  if (STANDARD_CONVERSIONS[norm1]?.[norm2]) return true;
  if (STANDARD_CONVERSIONS[norm2]?.[norm1]) return true;

  return false;
}
/**
 * Get standard conversion factor between two units, if available
 */
export function getStandardConversionFactor(fromUnit: string, toUnit: string): number | null {
  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (normFrom === normTo) return 1;

  if (STANDARD_CONVERSIONS[normFrom]?.[normTo]) {
    return STANDARD_CONVERSIONS[normFrom][normTo];
  }

  if (STANDARD_CONVERSIONS[normTo]?.[normFrom]) {
    return 1 / STANDARD_CONVERSIONS[normTo][normFrom];
  }

  return null;
}
/**
 * Detect unit mismatches for a list of ingredients
 */
export function detectUnitMismatches(
  ingredients: RecipeIngredientWithInventory[],
  customConversions: UnitConversion[] = []
): UnitMismatchWarning[] {
  const warnings: UnitMismatchWarning[] = [];

  for (const ingredient of ingredients) {
    const recipeUnit = normalizeUnit(ingredient.unit);
    const inventoryUnit = normalizeUnit(ingredient.inventoryItem.unit);

    if (recipeUnit === inventoryUnit) continue;

    const standardConversion = getStandardConversionFactor(recipeUnit, inventoryUnit);
    if (standardConversion !== null) continue;

    const customConversion = customConversions.find(c =>
      c.inventoryItemId === ingredient.inventoryItem.id &&
      normalizeUnit(c.fromUnit) === recipeUnit &&
      normalizeUnit(c.toUnit) === inventoryUnit
    );

    if (customConversion) {
      warnings.push({
        ingredientName: ingredient.inventoryItem.name,
        recipeUnit: ingredient.unit,
        inventoryUnit: ingredient.inventoryItem.unit,
        inventoryItemId: ingredient.inventoryItem.id,
        inventoryItemName: ingredient.inventoryItem.name,
        canConvert: true,
        conversion: customConversion,
      });
    } else {
      warnings.push({
        ingredientName: ingredient.inventoryItem.name,
        recipeUnit: ingredient.unit,
        inventoryUnit: ingredient.inventoryItem.unit,
        inventoryItemId: ingredient.inventoryItem.id,
        inventoryItemName: ingredient.inventoryItem.name,
        canConvert: false,
      });
    }
  }

  return warnings;
}
/**
 * Converts common fraction characters to decimal numbers
 * @param str The string to convert (e.g., "½", "¼", "1/2")
 * @returns The decimal number representation
 */
function parseFraction(str: string): number {
  const trimmed = str.trim();

  const fractionMap: Record<string, number> = {
    '¼': 0.25,
    '½': 0.5,
    '¾': 0.75,
    '⅓': 0.333,
    '⅔': 0.667,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875,
  };

  if (fractionMap[trimmed]) {
    return fractionMap[trimmed];
  }

  if (trimmed.includes('/')) {
    const [numerator, denominator] = trimmed.split('/').map(n => parseFloat(n.trim()));
    if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  const mixedMatch = trimmed.match(/^(\d+)\s*([¼½¾⅓⅔⅛⅜⅝⅞]|(\d+)\/(\d+))$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const fractionPart = mixedMatch[2];
    const fractionValue = fractionMap[fractionPart] ||
      (mixedMatch[3] ? parseFloat(mixedMatch[3]) / parseFloat(mixedMatch[4]) : 0);
    return whole + fractionValue;
  }

  const num = parseFloat(trimmed);
  return isNaN(num) ? 0 : num;
}
/**
 * Calculate the cost of a single ingredient with optional unit conversion
 * @param ingredient Recipe ingredient with linked inventory data
 * @param customConversions Optional custom unit conversions
 * @returns The cost calculation result with conversion info
 */
export function calculateIngredientCostWithConversion(
  ingredient: RecipeIngredientWithInventory,
  customConversions: UnitConversion[] = []
): CostCalculationResult {
  const recipeQuantity = parseFraction(ingredient.quantity);
  const inventoryQuantity = parseFraction(ingredient.inventoryItem.unitQuantity);
  const inventoryPrice = parseFloat(ingredient.inventoryItem.unitPrice);

  if (recipeQuantity === 0 || inventoryQuantity === 0 || isNaN(inventoryPrice)) {
    return { cost: 0, hasUnitMismatch: false };
  }

  const recipeUnit = normalizeUnit(ingredient.unit);
  const inventoryUnit = normalizeUnit(ingredient.inventoryItem.unit);

  let conversionFactor = 1;
  let hasUnitMismatch = false;
  let usedConversion: UnitConversion | undefined;

  if (recipeUnit !== inventoryUnit) {
    const standardConversion = getStandardConversionFactor(recipeUnit, inventoryUnit);

    if (standardConversion !== null) {
      conversionFactor = standardConversion;
    } else {
      const customConversion = customConversions.find(c =>
        c.inventoryItemId === ingredient.inventoryItem.id &&
        normalizeUnit(c.fromUnit) === recipeUnit &&
        normalizeUnit(c.toUnit) === inventoryUnit
      );

      if (customConversion) {
        conversionFactor = parseFloat(customConversion.conversionFactor);
        usedConversion = customConversion;
      } else {
        hasUnitMismatch = true;
      }
    }
  }

  const convertedQuantity = recipeQuantity * conversionFactor;
  const costPerUnit = inventoryPrice / inventoryQuantity;
  const totalCost = costPerUnit * convertedQuantity;

  return {
    cost: hasUnitMismatch ? 0 : totalCost,
    hasUnitMismatch,
    usedConversion
  };
}
/**
 * Calculate the cost of a single ingredient (legacy function)
 * @param ingredient Recipe ingredient with linked inventory data
 * @returns The cost of this ingredient for the recipe
 */
export function calculateIngredientCost(ingredient: RecipeIngredientWithInventory): number {
  const result = calculateIngredientCostWithConversion(ingredient, []);
  return result.cost;
}
/**
 * Calculate the total cost of a recipe based on its ingredients with linked inventory items
 * @param ingredients Array of recipe ingredients with inventory data
 * @param customConversions Optional custom unit conversions
 * @returns Total cost of the recipe in the same currency as unitPrice
 */
export function calculateRecipeCost(
  ingredients: RecipeIngredientWithInventory[],
  customConversions: UnitConversion[] = []
): number {
  let totalCost = 0;

  for (const ingredient of ingredients) {
    const result = calculateIngredientCostWithConversion(ingredient, customConversions);
    totalCost += result.cost;
  }

  return totalCost;
}
/**
 * Calculate recipe cost with detailed results including mismatch info
 */
export function calculateRecipeCostDetailed(
  ingredients: RecipeIngredientWithInventory[],
  customConversions: UnitConversion[] = []
): {
  totalCost: number;
  ingredientCosts: Array<{
    ingredient: RecipeIngredientWithInventory;
    result: CostCalculationResult;
  }>;
  mismatches: UnitMismatchWarning[];
  linkedCount: number;
  totalIngredients: number;
} {
  const ingredientCosts = ingredients.map(ingredient => ({
    ingredient,
    result: calculateIngredientCostWithConversion(ingredient, customConversions),
  }));

  const totalCost = ingredientCosts.reduce((sum, ic) => sum + ic.result.cost, 0);
  const mismatches = detectUnitMismatches(ingredients, customConversions);

  return {
    totalCost,
    ingredientCosts,
    mismatches: mismatches.filter(m => !m.canConvert),
    linkedCount: ingredients.length,
    totalIngredients: ingredients.length,
  };
}
/**
 * Format currency for display
 * @param amount The amount to format
 * @param currencySymbol The currency symbol (default: $)
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number,
  currencySymbol: string = "$",
  decimals: number = 2
): string {
  return `${currencySymbol}${amount.toFixed(decimals)}`;
}
/**
 * Calculate cost breakdown by ingredient
 * @param ingredients Array of recipe ingredients with inventory data
 * @param customConversions Optional custom unit conversions
 * @returns Array of ingredients with their individual costs
 */
export function calculateCostBreakdown(
  ingredients: RecipeIngredientWithInventory[],
  customConversions: UnitConversion[] = []
): Array<RecipeIngredientWithInventory & { cost: number; hasUnitMismatch: boolean }> {
  return ingredients.map(ingredient => {
    const result = calculateIngredientCostWithConversion(ingredient, customConversions);
    return {
      ...ingredient,
      cost: result.cost,
      hasUnitMismatch: result.hasUnitMismatch,
    };
  });
}
/**
 * Suggest a conversion factor based on common patterns
 * E.g., if someone uses "unit" for ham and inventory is in "g", suggest typical portion weights
 */
export function suggestConversionFactor(
  fromUnit: string,
  toUnit: string,
  itemName: string
): number | null {
  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (normFrom === 'unit' && normTo === 'g') {
    const lowerName = itemName.toLowerCase();
    if (lowerName.includes('ham') || lowerName.includes('meat')) return 100;
    if (lowerName.includes('cheese')) return 50;
    if (lowerName.includes('butter')) return 20;
    if (lowerName.includes('egg')) return 60;
    if (lowerName.includes('onion')) return 150;
    if (lowerName.includes('garlic')) return 5;
    if (lowerName.includes('lemon') || lowerName.includes('lime')) return 50;
    return 100;
  }

  if (normFrom === 'unit' && normTo === 'ml') {
    return 250;
  }

  return null;
}
