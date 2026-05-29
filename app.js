// ============================================================
// STATE
// ============================================================

let allRecipes = [];
let activeFilters = {
  search: '',
  cuisine: null,
  difficulty: null,
  time: null,
  tags: new Set(),
};

let drawerRecipe = null;
let drawerServings = 1;

// ============================================================
// CUISINE DISPLAY NAMES
// ============================================================

const CUISINE_LABELS = {
  korean: 'Korean',
  japanese: 'Japanese',
  thai: 'Thai',
  italian: 'Italian',
  mexican: 'Mexican',
  indian: 'Indian',
  'west-african': 'West African',
  smoothies: 'Smoothies',
  baking: 'Baking',
};

const TAG_LABELS = {
  quick: 'Quick',
  'meal-prep': 'Meal prep',
  'high-protein': 'High protein',
  'one-pan': 'One pan',
  'no-marinate': 'No marinate',
  'air-fryer': 'Air fryer',
  'pantry-friendly': 'Pantry friendly',
  fusion: 'Fusion',
};

const DIFFICULTY_LABELS = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
};

// ============================================================
// DATA LOADING
// ============================================================

async function loadRecipes() {
  try {
    const res = await fetch('recipes.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allRecipes = await res.json();
    init();
  } catch (err) {
    document.getElementById('recipeGrid').innerHTML =
      `<p style="color:#c17934;padding:40px 0;">
        Couldn't load recipes. Make sure you've run <code>python build.py</code>
        and that <code>recipes.json</code> exists next to <code>index.html</code>.
        <br><br><small>${err.message}</small>
      </p>`;
    console.error('Failed to load recipes.json:', err);
  }
}

// ============================================================
// INIT
// ============================================================

function init() {
  buildCuisineFilters();
  buildTagFilters();
  bindEvents();
  handleHashChange();
  render();
}

function buildCuisineFilters() {
  const cuisines = [...new Set(allRecipes.map(r => r.cuisine))].sort((a, b) => {
    const order = Object.keys(CUISINE_LABELS);
    return order.indexOf(a) - order.indexOf(b);
  });

  const container = document.getElementById('cuisineFilters');
  container.innerHTML = cuisines.map(c =>
    `<button class="pill" data-filter="cuisine" data-value="${c}">
      ${CUISINE_LABELS[c] || c}
    </button>`
  ).join('');
}

function buildTagFilters() {
  const tagCounts = {};
  allRecipes.forEach(r => (r.tags || []).forEach(t => {
    tagCounts[t] = (tagCounts[t] || 0) + 1;
  }));

  const tags = Object.entries(TAG_LABELS)
    .filter(([k]) => tagCounts[k])
    .map(([k, v]) => k);

  const container = document.getElementById('tagFilters');
  container.innerHTML = tags.map(t =>
    `<button class="pill" data-filter="tag" data-value="${t}">
      ${TAG_LABELS[t]}
    </button>`
  ).join('');
}

// ============================================================
// EVENTS
// ============================================================

function bindEvents() {
  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');

  searchInput.addEventListener('input', () => {
    activeFilters.search = searchInput.value.trim().toLowerCase();
    searchClear.classList.toggle('visible', activeFilters.search.length > 0);
    updateClearButton();
    render();
  });

  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    activeFilters.search = '';
    searchClear.classList.remove('visible');
    updateClearButton();
    render();
  });

  // Filter pills
  document.querySelector('.filters-inner').addEventListener('click', e => {
    const pill = e.target.closest('.pill');
    if (!pill) return;

    const filter = pill.dataset.filter;
    const value = pill.dataset.value;

    if (filter === 'cuisine') {
      if (activeFilters.cuisine === value) {
        activeFilters.cuisine = null;
        pill.classList.remove('active');
      } else {
        document.querySelectorAll('[data-filter="cuisine"]').forEach(p => p.classList.remove('active'));
        activeFilters.cuisine = value;
        pill.classList.add('active');
      }
    } else if (filter === 'difficulty') {
      if (activeFilters.difficulty === value) {
        activeFilters.difficulty = null;
        pill.classList.remove('active');
      } else {
        document.querySelectorAll('[data-filter="difficulty"]').forEach(p => p.classList.remove('active'));
        activeFilters.difficulty = value;
        pill.classList.add('active');
      }
    } else if (filter === 'time') {
      const num = parseInt(value);
      if (activeFilters.time === num) {
        activeFilters.time = null;
        pill.classList.remove('active');
      } else {
        document.querySelectorAll('[data-filter="time"]').forEach(p => p.classList.remove('active'));
        activeFilters.time = num;
        pill.classList.add('active');
      }
    } else if (filter === 'tag') {
      if (activeFilters.tags.has(value)) {
        activeFilters.tags.delete(value);
        pill.classList.remove('active');
      } else {
        activeFilters.tags.add(value);
        pill.classList.add('active');
      }
    }

    updateClearButton();
    render();
  });

  // Clear all
  document.getElementById('clearFilters').addEventListener('click', clearAllFilters);

  // Drawer close
  document.getElementById('backBtn').addEventListener('click', closeDetail);
  document.getElementById('overlay').addEventListener('click', closeDetail);

  // Hash routing
  window.addEventListener('hashchange', handleHashChange);

  // Keyboard
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDetail();
  });
}

function updateClearButton() {
  const hasFilters = activeFilters.search ||
    activeFilters.cuisine ||
    activeFilters.difficulty ||
    activeFilters.time ||
    activeFilters.tags.size > 0;

  document.getElementById('clearFilters').classList.toggle('visible', hasFilters);
}

function clearAllFilters() {
  activeFilters = { search: '', cuisine: null, difficulty: null, time: null, tags: new Set() };
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.remove('visible');
  document.querySelectorAll('.pill.active').forEach(p => p.classList.remove('active'));
  updateClearButton();
  render();
}

// ============================================================
// FILTERING
// ============================================================

function filterRecipes() {
  return allRecipes.filter(r => {
    // Search: name, description, keyIngredients
    if (activeFilters.search) {
      const q = activeFilters.search;
      const searchable = [
        r.name,
        r.description || '',
        ...(r.keyIngredients || []),
        ...(r.methods || []),
      ].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    if (activeFilters.cuisine && r.cuisine !== activeFilters.cuisine) return false;
    if (activeFilters.difficulty && r.difficulty !== activeFilters.difficulty) return false;
    if (activeFilters.time && r.time > activeFilters.time) return false;

    if (activeFilters.tags.size > 0) {
      const recipeTags = new Set(r.tags || []);
      for (const tag of activeFilters.tags) {
        if (!recipeTags.has(tag)) return false;
      }
    }

    return true;
  });
}

// ============================================================
// RENDER — GRID
// ============================================================

function render() {
  const filtered = filterRecipes();
  const grid = document.getElementById('recipeGrid');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('recipeCount');

  count.textContent = `${filtered.length} of ${allRecipes.length}`;

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  grid.innerHTML = filtered.map(r => renderCard(r)).join('');

  grid.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.id;
      window.location.hash = id;
    });
  });
}

function renderCard(r) {
  const diffLabel = DIFFICULTY_LABELS[r.difficulty] || r.difficulty;
  const cuisineLabel = CUISINE_LABELS[r.cuisine] || r.cuisine;
  const hasAttempt = r.firstAttemptNotes && r.firstAttemptNotes.date;

  const tags = (r.tags || []).slice(0, 3).map(t =>
    `<span class="card-tag">${TAG_LABELS[t] || t}</span>`
  ).join('');

  const protein = r.protein && r.protein.grams
    ? `<div class="card-protein"><strong>${r.protein.grams}g</strong> protein/serving</div>`
    : '';

  return `
    <article class="recipe-card" data-id="${r.id}" role="button" tabindex="0" aria-label="${r.name}">
      ${hasAttempt ? '<div class="card-attempted" title="Attempted"></div>' : ''}
      <div class="card-cuisine">${cuisineLabel}</div>
      <div class="card-name">${r.name}</div>
      <div class="card-meta">
        <span class="card-meta-item">${diffLabel}</span>
        <span class="card-divider"></span>
        <span class="card-meta-item">⏱ ${r.time} min</span>
      </div>
      ${tags ? `<div class="card-tags">${tags}</div>` : ''}
      ${protein}
    </article>
  `;
}

// ============================================================
// AMOUNT SCALING
// ============================================================

const UNICODE_FRACTIONS = {
  '½': 1/2, '¼': 1/4, '¾': 3/4,
  '⅓': 1/3, '⅔': 2/3,
  '⅛': 1/8, '⅜': 3/8, '⅝': 5/8, '⅞': 7/8,
};

// Parse a leading number (integer, decimal, or unicode fraction) from a string.
// Returns { value: number, rest: string } or null if no number found.
function parseLeadingNumber(s) {
  // Integer + unicode fraction: "1½", "2 ¾"
  const intFracRe = /^(\d+)\s*(½|¼|¾|⅓|⅔|⅛|⅜|⅝|⅞)/;
  let m = s.match(intFracRe);
  if (m) return { value: parseInt(m[1]) + UNICODE_FRACTIONS[m[2]], rest: s.slice(m[0].length) };

  // Standalone unicode fraction
  for (const [frac, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.startsWith(frac)) return { value: val, rest: s.slice(frac.length) };
  }

  // Integer or decimal
  m = s.match(/^(\d+\.?\d*)/);
  if (m) return { value: parseFloat(m[1]), rest: s.slice(m[0].length) };

  return null;
}

// Format a scaled number as a readable string, using unicode fractions where possible.
function formatNumber(n) {
  if (n === 0) return '0';

  const FRAC_MAP = [
    [1/8, '⅛'], [1/4, '¼'], [1/3, '⅓'], [3/8, '⅜'],
    [1/2, '½'], [5/8, '⅝'], [2/3, '⅔'], [3/4, '¾'], [7/8, '⅞'],
  ];

  const whole = Math.floor(n);
  const frac = n - whole;

  if (frac < 0.04) return String(whole);

  for (const [val, sym] of FRAC_MAP) {
    if (Math.abs(frac - val) < 0.04) {
      return whole > 0 ? `${whole}${sym}` : sym;
    }
  }

  // Fall back to decimal
  if (n < 10) return parseFloat(n.toFixed(1)).toString();
  return String(Math.round(n));
}

// Scale an amount string by the given factor.
// Handles: "300g", "3 tbsp", "½", "1½ cups", "2–3 tbsp", "~4–5 tbsp", "1 can (540ml)"
// Returns the original string unchanged if it can't be parsed.
function scaleAmount(amountStr, scale) {
  if (scale === 1) return amountStr;
  if (amountStr === null || amountStr === undefined) return amountStr;

  const str = String(amountStr).trim();
  if (!str) return str;

  const approx = str.startsWith('~');
  const s = approx ? str.slice(1).trimStart() : str;
  const prefix = approx ? '~' : '';

  const first = parseLeadingNumber(s);
  if (!first) return str; // unparseable — return as-is

  // Check for a range: "2–3 tbsp", "300–350g"
  const afterFirst = first.rest.trimStart();
  if (afterFirst.startsWith('–') || (afterFirst.startsWith('-') && /\d/.test(afterFirst[1]))) {
    const afterDash = afterFirst.slice(1).trimStart();
    const second = parseLeadingNumber(afterDash);
    if (second) {
      const lo = formatNumber(first.value * scale);
      const hi = formatNumber(second.value * scale);
      const unit = second.rest.trim();
      return `${prefix}${lo}–${hi}${unit ? ' ' + unit : ''}`.trim();
    }
  }

  // Simple number + unit suffix
  const scaled = formatNumber(first.value * scale);
  const unit = first.rest.trim();
  return `${prefix}${scaled}${unit ? ' ' + unit : ''}`.trim();
}

// ============================================================
// RENDER — DETAIL
// ============================================================

function openDetail(recipe) {
  drawerRecipe = recipe;
  drawerServings = recipe.servings || 1;

  const drawer = document.getElementById('detailDrawer');
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('detailContent');

  content.innerHTML = renderDetail(recipe);
  content.scrollTop = 0;

  // Bind stepper buttons (freshly rendered each open)
  const minus = document.getElementById('servingsMinus');
  const plus  = document.getElementById('servingsPlus');
  if (minus) minus.addEventListener('click', () => {
    if (drawerServings > 1) { drawerServings--; updateIngredients(); }
  });
  if (plus) plus.addEventListener('click', () => {
    if (drawerServings < 10) { drawerServings++; updateIngredients(); }
  });

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

// Re-render ingredient amounts and macros in-place after a servings change.
function updateIngredients() {
  const container = document.getElementById('ingredientGroupsContainer');
  if (!container || !drawerRecipe) return;

  const scale = drawerServings / (drawerRecipe.servings || 1);
  container.innerHTML = renderIngredientGroupsInner(drawerRecipe.ingredientGroups, scale);

  const countEl = document.getElementById('servingsCount');
  if (countEl) countEl.textContent = drawerServings;

  const labelEl = document.getElementById('servingsLabel');
  if (labelEl) labelEl.textContent = drawerServings === 1 ? 'serving' : 'servings';

  const minus = document.getElementById('servingsMinus');
  const plus  = document.getElementById('servingsPlus');
  if (minus) minus.disabled = drawerServings <= 1;
  if (plus)  plus.disabled  = drawerServings >= 10;

  // Macros always show per-serving — do not rescale with servings count
  const macrosBox = document.getElementById('macrosBox');
  if (macrosBox && drawerRecipe.computedMacros) {
    macrosBox.innerHTML = renderMacroValues(drawerRecipe.computedMacros, 1);
  }
}

function closeDetail() {
  drawerRecipe = null;

  const drawer = document.getElementById('detailDrawer');
  const overlay = document.getElementById('overlay');

  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';

  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname);
  }
}

function handleHashChange() {
  const id = window.location.hash.slice(1);
  if (!id) {
    closeDetail();
    return;
  }
  if (allRecipes.length === 0) return;

  const recipe = allRecipes.find(r => r.id === id);
  if (recipe) openDetail(recipe);
}

function renderDetail(r) {
  const cuisineLabel = CUISINE_LABELS[r.cuisine] || r.cuisine;
  const diffLabel = DIFFICULTY_LABELS[r.difficulty] || r.difficulty;

  const methods = (r.methods || []).map(m =>
    `<span class="method-tag">${m}</span>`
  ).join('');

  const servingsStepper = r.servings ? `
    <span class="detail-meta-item servings-stepper">
      🍽
      <button class="servings-btn" id="servingsMinus" aria-label="Fewer servings"${drawerServings <= 1 ? ' disabled' : ''}>−</button>
      <span id="servingsCount">${drawerServings}</span>
      <span id="servingsLabel">${drawerServings === 1 ? 'serving' : 'servings'}</span>
      <button class="servings-btn" id="servingsPlus" aria-label="More servings"${drawerServings >= 10 ? ' disabled' : ''}>+</button>
    </span>
  ` : '';

  return `
    <div class="detail-cuisine">${cuisineLabel}</div>
    <h2 class="detail-title">${r.name}</h2>

    <div class="detail-meta">
      <span class="detail-meta-item">${diffLabel}</span>
      <span class="detail-meta-item">⏱ ${r.time} min</span>
      ${servingsStepper}
    </div>

    ${methods ? `<div class="detail-methods">${methods}</div>` : ''}

    ${r.description ? `<p class="detail-description">${r.description}</p>` : ''}

    ${renderMacros(r.computedMacros)}
    ${renderIngredientGroups(r.ingredientGroups)}
    ${renderInstructions(r.instructions)}
    ${renderProtein(r.protein)}
    ${renderFirstAttempt(r.firstAttemptNotes)}
    ${renderTips(r.tips)}
  `;
}

function renderIngredientGroups(groups) {
  if (!groups || groups.length === 0) return '';

  return `
    <div class="detail-section">
      <div class="detail-section-title">Ingredients</div>
      <div id="ingredientGroupsContainer">
        ${renderIngredientGroupsInner(groups, 1)}
      </div>
    </div>
  `;
}

function renderIngredientGroupsInner(groups, scale = 1) {
  return (groups || []).map(g => {
    const ingredients = (g.ingredients || []).map(ing => {
      const rawAmount = (ing.amount !== null && ing.amount !== undefined) ? String(ing.amount) : null;
      const displayAmount = rawAmount ? scaleAmount(rawAmount, scale) : null;
      const amount = displayAmount ? `<span class="ingredient-amount">${displayAmount}</span>` : '';
      const note = ing.note ? `<span class="ingredient-note"> — ${ing.note}</span>` : '';

      const alts = (ing.alternatives || []).length > 0
        ? `<ul class="ingredient-alternatives">
            ${ing.alternatives.map(a => {
              const altRaw = (a.amount !== null && a.amount !== undefined) ? String(a.amount) : null;
              const altDisplay = altRaw ? scaleAmount(altRaw, scale) : null;
              const altAmount = altDisplay ? `${altDisplay} ` : '';
              const altNote = a.note ? ` — <em>${a.note}</em>` : '';
              return `<li class="alt-item"><span class="alt-prefix">or</span> ${altAmount}${a.name}${altNote}</li>`;
            }).join('')}
          </ul>`
        : '';

      return `<li class="ingredient-item">${amount}${ing.name}${note}${alts}</li>`;
    }).join('');

    return `
      <div class="ingredient-group">
        <div class="group-header">
          <span class="group-emoji">${g.emoji || ''}</span>
          <span class="group-label">${g.label || ''}</span>
          ${g.actionNote ? `<span class="group-action">${g.actionNote}</span>` : ''}
        </div>
        <ul class="ingredient-list">${ingredients}</ul>
      </div>
    `;
  }).join('');
}

function renderInstructions(instructions) {
  if (!instructions || instructions.length === 0) return '';

  let html = '';
  let flatSteps = [];

  function flushFlatSteps() {
    if (flatSteps.length === 0) return;
    html += `<ol class="instructions-list">
      ${flatSteps.map(s => `<li class="instruction-step">${s}</li>`).join('')}
    </ol>`;
    flatSteps = [];
  }

  instructions.forEach(item => {
    if (item.step !== undefined) {
      flatSteps.push(item.step);
    } else if (item.section !== undefined) {
      flushFlatSteps();
      const sectionSteps = (item.steps || []).map(s =>
        `<li class="instruction-step">${s}</li>`
      ).join('');
      html += `
        <div class="instruction-section">
          <div class="instruction-section-title">${item.section}</div>
          <ol class="instructions-list">${sectionSteps}</ol>
        </div>
      `;
    }
  });

  flushFlatSteps();

  return `
    <div class="detail-section">
      <div class="detail-section-title">Instructions</div>
      ${html}
    </div>
  `;
}

// Inner HTML for the macros box — called on first render and on every servings change.
function renderMacroValues(macros, scale) {
  const cal     = Math.round(macros.cal     * scale);
  const protein = parseFloat((macros.protein * scale).toFixed(1));
  const fat     = parseFloat((macros.fat     * scale).toFixed(1));
  const carbs   = parseFloat((macros.carbs   * scale).toFixed(1));

  return `
    <div class="macro-item">
      <span class="macro-value">${cal}</span>
      <span class="macro-label">cal</span>
    </div>
    <div class="macro-item">
      <span class="macro-value">${protein}g</span>
      <span class="macro-label">protein</span>
    </div>
    <div class="macro-item">
      <span class="macro-value">${fat}g</span>
      <span class="macro-label">fat</span>
    </div>
    <div class="macro-item">
      <span class="macro-value">${carbs}g</span>
      <span class="macro-label">carbs</span>
    </div>
  `;
}

function renderMacros(macros) {
  if (!macros) return '';
  return `
    <div class="detail-section macros-section">
      <div class="detail-section-title">
        Estimated macros
        <span class="macros-per-serving">per serving</span>
      </div>
      <div id="macrosBox" class="macros-grid">
        ${renderMacroValues(macros, 1)}
      </div>
    </div>
  `;
}

function renderProtein(protein) {
  if (!protein) return '';
  if (!protein.grams && !protein.note) return '';

  const grams = protein.grams
    ? `<span class="protein-grams">${protein.grams}g</span> protein per serving`
    : '';
  const note = protein.note
    ? (protein.grams ? ` — ${protein.note}` : protein.note)
    : '';

  return `
    <div class="detail-section">
      <div class="detail-section-title">Protein</div>
      <div class="protein-box">${grams}${note}</div>
    </div>
  `;
}

function renderFirstAttempt(notes) {
  if (!notes || !notes.date) return '';

  const items = (notes.notes || []).map(n =>
    `<li class="attempt-item">${n}</li>`
  ).join('');

  return `
    <div class="detail-section">
      <div class="detail-section-title">First attempt notes</div>
      <div class="attempt-notes">
        <div class="attempt-date">${notes.date}</div>
        ${items ? `<ul class="attempt-list">${items}</ul>` : ''}
      </div>
    </div>
  `;
}

function renderTips(tips) {
  if (!tips || tips.length === 0) return '';

  const items = tips.map(t =>
    `<li class="tip-item">
      <span class="tip-keyword">${t.keyword}.</span> ${t.text}
    </li>`
  ).join('');

  return `
    <div class="detail-section">
      <div class="detail-section-title">Tips</div>
      <ul class="tips-list">${items}</ul>
    </div>
  `;
}

// ============================================================
// START
// ============================================================

loadRecipes();
