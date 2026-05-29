import json
recipes = json.load(open('recipes.json', encoding='utf-8'))
for r in recipes:
    m = r.get('computedMacros')
    p = r.get('protein', {})
    computed = m['protein'] if m else None
    stated = p.get('grams') if p else None
    note = p.get('note', '') if p else ''
    print(f"{r['id']:<45} computed={str(computed):<8} stated={stated}")
