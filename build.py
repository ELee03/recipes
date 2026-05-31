#!/usr/bin/env python3
"""
build.py — Recipe site build script
Reads all YAML recipe files from data/ and outputs recipes.json.
Also computes estimated per-serving macros using nutrients.json.

Usage:
    python build.py

Requirements:
    pip install pyyaml

Run this script any time you add or edit a recipe, then commit everything
(including the updated recipes.json) and push to GitHub.
"""

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Error: PyYAML not installed. Run: pip install pyyaml")
    sys.exit(1)

DATA_DIR      = Path(__file__).parent / "data"
OUTPUT_FILE   = Path(__file__).parent / "recipes.json"
NUTRIENTS_FILE = Path(__file__).parent / "nutrients.json"

CUISINE_ORDER = [
    "korean", "japanese", "thai", "italian", "mexican",
    "indian", "west-african", "caribbean", "smoothies", "baking"
]

# Adjective words that describe how an ingredient is prepared/sized but are
# NOT a unit.  When the parsed "unit" is entirely made up of these words we
# fall back to treating the number as a plain count (→ "each" in units_map).
COUNT_DESCRIPTORS = frozenset([
    'boneless', 'skinless', 'bone-in', 'bone', 'in', 'large', 'small',
    'medium', 'whole', 'fresh', 'frozen', 'thin', 'thick', 'ripe', 'firm',
    'raw', 'cooked', 'halved', 'quartered', 'sliced', 'diced', 'chopped',
    'minced', 'grated', 'shredded', 'roughly', 'finely', 'about', 'approx',
])

# Unicode fraction → float
UNICODE_FRACTIONS = {
    '½': 0.5,       '¼': 0.25,      '¾': 0.75,
    '⅓': 1/3,       '⅔': 2/3,
    '⅛': 0.125,     '⅜': 0.375,     '⅝': 0.625,     '⅞': 0.875,
}


# ============================================================
# RECIPE LOADING
# ============================================================

def load_recipes():
    recipes = []
    errors  = []

    for yaml_file in sorted(DATA_DIR.rglob("*.yaml")):
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                recipe = yaml.safe_load(f)

            required = ["id", "name", "cuisine", "difficulty", "time"]
            missing  = [k for k in required if k not in recipe]
            if missing:
                errors.append(f"{yaml_file.name}: missing fields: {missing}")
                continue

            recipes.append(recipe)

        except yaml.YAMLError as e:
            errors.append(f"{yaml_file.name}: YAML parse error — {e}")
        except Exception as e:
            errors.append(f"{yaml_file.name}: {e}")

    return recipes, errors


def sort_recipes(recipes):
    def sort_key(r):
        cuisine_rank = CUISINE_ORDER.index(r["cuisine"]) if r["cuisine"] in CUISINE_ORDER else 99
        return (cuisine_rank, r.get("name", ""))
    return sorted(recipes, key=sort_key)


# ============================================================
# NUTRIENT DATABASE
# ============================================================

def load_nutrients():
    if not NUTRIENTS_FILE.exists():
        return {}
    with open(NUTRIENTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


# ============================================================
# AMOUNT PARSING
# ============================================================

def _parse_leading_number(s):
    """Parse the leading number from s (int, decimal, or unicode fraction).
    Returns (float_value, remainder_string) or (None, s) on failure."""
    s = s.strip()

    # Integer immediately followed by unicode fraction: "1½", "2 ¾"
    for frac, val in UNICODE_FRACTIONS.items():
        m = re.match(r'^(\d+)\s*' + re.escape(frac), s)
        if m:
            return int(m.group(1)) + val, s[m.end():]

    # Standalone unicode fraction
    for frac, val in UNICODE_FRACTIONS.items():
        if s.startswith(frac):
            return val, s[len(frac):]

    # Integer or decimal
    m = re.match(r'^(\d+\.?\d*)', s)
    if m:
        return float(m.group(1)), s[m.end():]

    return None, s


def parse_amount_grams(amount_str, units_map):
    """Convert an ingredient amount string to grams.

    Handles:
      "300g", "1 cup", "2 tbsp", "½ tsp", "1½ cups",
      "300–350g" (ranges → midpoint), "~180g", "1 can (540ml)" (strips parens),
      bare counts with no unit when units_map has an "each" entry.

    Returns float (grams) or None if unparseable.
    """
    if not amount_str:
        return None

    s = str(amount_str).strip()

    # Special case: "2 fillets (~150–180g each)" — extract per-item grams
    # from the parenthetical before stripping it.
    paren_each = re.search(
        r'\(\s*~?\s*(\d+\.?\d*)\s*(?:[–-]\s*(\d+\.?\d*)\s*)?g\s+each\s*\)',
        s, re.IGNORECASE
    )
    if paren_each:
        lo = float(paren_each.group(1))
        hi = float(paren_each.group(2)) if paren_each.group(2) else lo
        per_item_g = (lo + hi) / 2.0
        count_str = re.sub(r'\(.*?\)', '', s).strip().lstrip('~').strip()
        count_val, _ = _parse_leading_number(count_str)
        if count_val is not None:
            return count_val * per_item_g

    # Strip leading approximation marker
    if s.startswith('~'):
        s = s[1:].strip()

    # Strip parenthetical notes: "(540ml)", "(~150–180g each)"
    s = re.sub(r'\(.*?\)', '', s).strip()

    if not s:
        return None

    first_val, rest = _parse_leading_number(s)
    if first_val is None:
        return None

    rest = rest.strip()

    # Range (en-dash or ASCII hyphen followed immediately by a digit) → midpoint
    if rest.startswith('–') or (rest.startswith('-') and len(rest) > 1 and rest[1].isdigit()):
        second_val, rest2 = _parse_leading_number(rest[1:])
        if second_val is not None:
            first_val = (first_val + second_val) / 2.0
            rest = rest2.strip()

    unit = rest.lower().strip()

    # --- Direct metric units ---
    if unit in ('g', 'gram', 'grams', 'gr'):
        return first_val
    if unit == 'kg':
        return first_val * 1000
    if unit in ('ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'):
        return first_val          # 1 ml ≈ 1 g for water-based liquids
    if unit in ('l', 'liter', 'liters', 'litre', 'litres'):
        return first_val * 1000

    # --- Named unit lookup ---
    if unit in units_map:
        return first_val * units_map[unit]

    # Plural stripping: "cups" → "cup", "cloves" → "clove"
    if unit.endswith('s') and unit[:-1] in units_map:
        return first_val * units_map[unit[:-1]]

    # Bare count with no unit → treat as "each" if available
    if unit == '' and 'each' in units_map:
        return first_val * units_map['each']

    # Unit is entirely adjective descriptors (e.g. "boneless", "large", "ripe")
    # → treat as a plain count and fall back to "each"
    unit_tokens = set(unit.split())
    if unit_tokens and unit_tokens.issubset(COUNT_DESCRIPTORS) and 'each' in units_map:
        return first_val * units_map['each']

    return None     # unit not recognised


# ============================================================
# INGREDIENT → NUTRIENT MATCHING
# ============================================================

def find_nutrient_key(ingredient_name, nutrients):
    """Return the best-matching key in `nutrients` for the given ingredient name.

    Strategy: longest substring match (so "ground beef 90/10" wins over "beef").
    Cleans up parentheticals and comma-separated descriptors before matching.
    """
    if not ingredient_name:
        return None

    name_lower = ingredient_name.lower().strip()
    name_clean = re.sub(r'\(.*?\)', '', name_lower).strip()   # drop "(Tostitos or similar)"
    name_clean = re.sub(r',.*', '', name_clean).strip()        # drop ", shredded"

    best_key = None
    best_len = 0

    for variant in (name_clean, name_lower):
        for key in nutrients:
            if key.startswith('_'):
                continue
            kl = key.lower()
            if kl in variant and len(kl) > best_len:
                best_key = key
                best_len = len(kl)
        if best_key:
            break

    return best_key


# ============================================================
# MACRO COMPUTATION
# ============================================================

def compute_macros(recipe, nutrients):
    """Estimate per-serving macros for a recipe.

    Iterates all non-optional ingredient groups, matches each ingredient to
    the nutrient DB, converts amounts to grams, and sums cal/protein/fat/carbs.
    Divides by servings count to get per-serving values.

    Returns a dict {cal, protein, fat, carbs} or None if nothing could be matched.
    """
    if not nutrients:
        return None

    servings = recipe.get('servings') or 1
    total    = {'cal': 0.0, 'protein': 0.0, 'fat': 0.0, 'carbs': 0.0}
    matched  = 0
    breakdown_raw = {}  # key -> protein grams (total, pre-serving-divide)

    for group in (recipe.get('ingredientGroups') or []):
        # Skip groups labelled as optional
        label = (group.get('label') or '').lower()
        if 'optional' in label:
            continue

        for ing in (group.get('ingredients') or []):
            name       = (ing.get('name') or '').strip()
            amount_raw = ing.get('amount')

            if amount_raw is None:
                continue    # "as much as you like", no amount → skip

            key = find_nutrient_key(name, nutrients)
            if key is None:
                continue    # spice, herb, water, etc. — not in DB

            n     = nutrients[key]
            grams = parse_amount_grams(str(amount_raw), n.get('units') or {})

            if grams is None or grams <= 0:
                continue

            factor           = grams / 100.0
            total['cal']     += n['cal']     * factor
            total['protein'] += n['protein'] * factor
            total['fat']     += n['fat']     * factor
            total['carbs']   += n['carbs']   * factor
            matched          += 1

            protein_contrib = n['protein'] * factor
            if protein_contrib > 0:
                breakdown_raw[key] = breakdown_raw.get(key, 0.0) + protein_contrib

    if matched == 0:
        return None

    # Build per-serving breakdown; only include items contributing >= 1g protein/serving
    breakdown = []
    for key, total_protein in breakdown_raw.items():
        per_serving = round(total_protein / servings, 1)
        if per_serving >= 1.0:
            breakdown.append({'name': key, 'protein': per_serving})
    breakdown.sort(key=lambda x: -x['protein'])

    return {
        'cal':       round(total['cal']     / servings),
        'protein':   round(total['protein'] / servings, 1),
        'fat':       round(total['fat']     / servings, 1),
        'carbs':     round(total['carbs']   / servings, 1),
        'breakdown': breakdown,
    }


# ============================================================
# MAIN
# ============================================================

def main():
    print("Building recipes.json...")

    if not DATA_DIR.exists():
        print(f"Error: data/ directory not found at {DATA_DIR}")
        sys.exit(1)

    recipes, errors = load_recipes()

    if errors:
        print(f"\n{len(errors)} error(s) found:")
        for e in errors:
            print(f"  ERROR: {e}")
        print()

    recipes = sort_recipes(recipes)

    # Load nutrient database and annotate each recipe with computed macros
    nutrients = load_nutrients()
    if nutrients:
        n_entries = len([k for k in nutrients if not k.startswith('_')])
        print(f"  Loaded nutrient DB ({n_entries} entries)")
        macro_count = 0
        for recipe in recipes:
            macros = compute_macros(recipe, nutrients)
            if macros:
                recipe['computedMacros'] = macros
                macro_count += 1
        print(f"  Computed macros for {macro_count}/{len(recipes)} recipes")
    else:
        print("  (nutrients.json not found — skipping macro computation)")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)

    print(f"Built {len(recipes)} recipes -> recipes.json")

    if errors:
        print(f"  ({len(errors)} file(s) skipped due to errors)")


if __name__ == "__main__":
    main()
