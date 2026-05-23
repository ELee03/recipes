#!/usr/bin/env python3
"""
build.py — Recipe site build script
Reads all YAML recipe files from data/ and outputs recipes.json.

Usage:
    python build.py

Requirements:
    pip install pyyaml

Run this script any time you add or edit a recipe, then commit everything
(including the updated recipes.json) and push to GitHub.
"""

import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("Error: PyYAML not installed. Run: pip install pyyaml")
    sys.exit(1)

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = Path(__file__).parent / "recipes.json"

CUISINE_ORDER = [
    "korean", "japanese", "thai", "italian", "mexican",
    "indian", "west-african", "smoothies", "baking"
]


def load_recipes():
    recipes = []
    errors = []

    for yaml_file in sorted(DATA_DIR.rglob("*.yaml")):
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                recipe = yaml.safe_load(f)

            # Basic validation
            required = ["id", "name", "cuisine", "difficulty", "time"]
            missing = [k for k in required if k not in recipe]
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


def main():
    print("Building recipes.json...")

    if not DATA_DIR.exists():
        print(f"Error: data/ directory not found at {DATA_DIR}")
        sys.exit(1)

    recipes, errors = load_recipes()

    if errors:
        print(f"\n{len(errors)} error(s) found:")
        for e in errors:
            print(f"  ✗ {e}")
        print()

    recipes = sort_recipes(recipes)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(recipes, f, ensure_ascii=False, indent=2)

    print(f"✓ Built {len(recipes)} recipes → recipes.json")

    if errors:
        print(f"  ({len(errors)} file(s) skipped due to errors)")


if __name__ == "__main__":
    main()
