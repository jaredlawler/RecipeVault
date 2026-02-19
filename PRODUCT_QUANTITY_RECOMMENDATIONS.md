# Product Quantity & Costing Recommendations

## The Core Problem

Products arrive in purchase units (bunch, carton, loaf) but get used in recipe units (grams, each, slices). Right now there's no clean bridge between these two, making costs inaccurate and inventory confusing.

**Real examples:**
- Basil: buy 1 bunch ($2.50) → recipe calls for 50g → how much does that cost?
- Tortillas: buy 1 carton of 72 ($18.00) → recipe uses 2 tortillas → cost = $0.50
- Bread: buy 1 loaf ($4.50 / 8 slices) → recipe uses 3 slices → cost = $1.69

---

## Recommended Data Model

Each product/ingredient needs **two layers** plus an auto-calculated cost:

```
Purchase Layer:
  purchaseUnit     → "bunch", "carton", "loaf", "kg", "bag"
  purchasePrice    → $2.50 (what you pay per purchase unit)

Usage Layer:
  recipeUnit       → "g", "each", "ml"
  unitsPerPurchase → how many recipe units come in one purchase unit
                     e.g. 100 (grams per bunch), 72 (tortillas per carton), 8 (slices per loaf)

Auto-calculated:
  costPerRecipeUnit → purchasePrice ÷ unitsPerPurchase
                      e.g. $2.50 ÷ 100g = $0.025 per gram
```

This is one extra field (`unitsPerPurchase`) that unlocks accurate per-unit costing automatically.

---

## Concrete Examples

| Product       | Purchase Unit | Purchase Price | Units Per Purchase | Recipe Unit | Cost Per Recipe Unit |
|---------------|--------------|----------------|--------------------|-------------|----------------------|
| Basil         | bunch        | $2.50          | 100                | g           | $0.025/g             |
| Tortillas     | carton       | $18.00         | 72                 | each        | $0.25 each           |
| Bread         | loaf         | $4.50          | 8                  | each (slice)| $0.56/slice          |
| Chicken Breast| kg           | $12.00         | 1000               | g           | $0.012/g             |
| Olive Oil     | 4L bottle    | $32.00         | 4000               | ml          | $0.008/ml            |

---

## Schema Changes Required

In `shared/schema.ts`, the ingredients/products table needs these fields added or clarified:

```typescript
// Current (assumed):
purchaseUnit: text           // "bunch", "kg", "each"
costPerUnit: numeric         // cost per purchase unit

// Add or rename:
purchaseUnit: text           // "bunch", "carton", "loaf"  ← how you BUY it
purchasePrice: numeric       // price paid per purchase unit
recipeUnit: text             // "g", "each", "ml"  ← how recipes USE it
unitsPerPurchase: numeric    // 100g per bunch, 72 per carton, 8 per loaf

// Auto-calculated (can be a DB generated column or computed in costCalculator):
costPerRecipeUnit: numeric   // = purchasePrice / unitsPerPurchase
```

---

## UI Changes Required

### 1. Product Setup Screen (admin-ingredient-linker or recipe-manager)

Replace any single "unit" field with a clean two-part input:

```
Product Name:   [ Basil                    ]

HOW YOU BUY IT
  Purchase unit:  [ bunch      ]   Price: [ $2.50  ]

HOW YOU USE IT
  Each bunch contains: [ 100 ] [ g ▾ ]

AUTO-CALCULATED (read-only, shown clearly):
  ✓ Cost per gram: $0.025
```

Keep it on one screen. The "auto-calculated" line should update live as the user types — this is the trust-builder that confirms the numbers make sense.

**Key UX rules:**
- Show the calculated cost per recipe unit immediately and prominently
- Use plain language ("Each bunch contains") not jargon ("unitsPerPurchase")
- Default recipe unit to "g" since that's what you use most
- For "each" items like tortillas, label it as "pieces per carton" or "slices per loaf"

### 2. Recipe Ingredient Lines

When adding an ingredient to a recipe, show both:

```
Basil    [ 50 ] [g▾]    Cost: $1.25    (based on $0.025/g × 50g)
```

This makes costing transparent without any extra steps.

### 3. Inventory Counting

When doing a stock count, let staff count in the natural unit:

```
Basil:    [ 2 ] bunches   (= 200g ≈ $5.00 value)
```

Convert to grams behind the scenes for recipe calculations. Show both to build confidence.

---

## Unit Type Groups

To avoid mistakes (like entering ml when g is expected), group units by type:

**Weight (for most ingredients):**
- g ← default
- kg

**Count (for packaged items):**
- each
- slice / piece

**Volume (for liquids):**
- ml
- L

**Loose/Bunch items:**
- bunch → always ask "how many grams per bunch?"
- sprig → always ask "how many grams per sprig?"

The UI should detect when someone picks a "bunch" purchase unit and automatically prompt: "How many grams does a bunch weigh?"

---

## Handling the Basil "Half Bunch" Problem Specifically

The issue is staff think in "half a bunch" but the system needs grams.

**Solution:** Let them enter either, convert behind the scenes.

On the recipe ingredient input, allow:
- Typing `50` in grams → stored as 50g
- OR typing `0.5` with unit `bunch` → system converts: 0.5 × 100g = 50g, stored as 50g

The product's `unitsPerPurchase` field (100g/bunch) enables this conversion automatically.

The recipe always stores in the base recipe unit (grams), so costing is always consistent.

---

## What NOT to Build

Keep it simple:
- No complex unit conversion chains (g → kg → lb → oz). Just: purchase unit → recipe unit. Two steps only.
- No "waste percentage" or "yield factor" for now — that's a separate problem and adds complexity
- No multiple purchase sizes per ingredient for now (e.g., "1kg bag vs 5kg bag"). One active purchase unit per ingredient
- No automatic supplier unit detection — let the user enter it manually, it only needs to be set once

---

## Implementation Priority

1. **Schema change**: Add `unitsPerPurchase` and `recipeUnit` fields (if not already separate)
2. **Cost calculator update**: `shared/recipeCostCalculator.ts` — use `purchasePrice / unitsPerPurchase` instead of any flat `costPerUnit`
3. **Product edit UI**: Update the ingredient/product form to show the two-layer input with live cost preview
4. **Recipe ingredient lines**: Show calculated cost per ingredient line
5. **Inventory counting**: Allow counting in purchase units, display grams equivalent

---

## Quick Wins (Can Ship Immediately)

These require no schema changes if `unitsPerPurchase` already exists in some form:

- **Live cost preview** on the product edit screen — shows "cost per g" updating as you type price and gram count
- **Recipe line costs** — show $X.XX next to each ingredient line in the recipe editor
- **Tortilla/bread display** — if `recipeUnit = each` and `unitsPerPurchase` is filled, display "72 per carton" clearly on the ingredient card
