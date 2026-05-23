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
// RENDER — DETAIL
// ============================================================

function openDetail(recipe) {
  const drawer = document.getElementById('detailDrawer');
  const overlay = document.getElementById('overlay');
  const content = document.getElementById('detailContent');

  content.innerHTML = renderDetail(recipe);
  content.scrollTop = 0;

  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeDetail() {
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
  if (allRecipes.length === 0) return; // Not loaded yet

  const recipe = allRecipes.find(r => r.id === id);
  if (recipe) openDetail(recipe);
}

function renderDetail(r) {
  const cuisineLabel = CUISINE_LABELS[r.cuisine] || r.cuisine;
  const diffLabel = DIFFICULTY_LABELS[r.difficulty] || r.difficulty;

  const methods = (r.methods || []).map(m =>
    `<span class="method-tag">${m}</span>`
  ).join('');

  return `
    <div class="detail-cuisine">${cuisineLabel}</div>
    <h2 class="detail-title">${r.name}</h2>

    <div class="detail-meta">
      <span class="detail-meta-item">${diffLabel}</span>
      <span class="detail-meta-item">⏱ ${r.time} min</span>
      ${r.servings ? `<span class="detail-meta-item">🍽 ${r.servings} serving${r.servings > 1 ? 's' : ''}</span>` : ''}
    </div>

    ${methods ? `<div class="detail-methods">${methods}</div>` : ''}

    ${r.description ? `<p class="detail-description">${r.description}</p>` : ''}

    ${renderIngredientGroups(r.ingredientGroups)}
    ${renderInstructions(r.instructions)}
    ${renderProtein(r.protein)}
    ${renderFirstAttempt(r.firstAttemptNotes)}
    ${renderTips(r.tips)}
  `;
}

function renderIngredientGroups(groups) {
  if (!groups || groups.length === 0) return '';

  const html = groups.map(g => {
    const ingredients = (g.ingredients || []).map(ing => {
      const amount = ing.amount ? `<span class="ingredient-amount">${ing.amount}</span>` : '';
      const note = ing.note ? `<span class="ingredient-note"> — ${ing.note}</span>` : '';

      const alts = (ing.alternatives || []).length > 0
        ? `<ul class="ingredient-alternatives">
            ${ing.alternatives.map(a => {
              const altAmount = a.amount ? `${a.amount} ` : '';
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

  return `
    <div class="detail-section">
      <div class="detail-section-title">Ingredients</div>
      ${html}
    </div>
  `;
}

function renderInstructions(instructions) {
  if (!instructions || instructions.length === 0) return '';

  // Group consecutive steps vs sections
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
