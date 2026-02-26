/* ===========================
   FINANZA — script.js
   =========================== */

// ===== STATE =====
let currentDate = new Date();

let expenses = JSON.parse(localStorage.getItem('finanza_expenses') || '[]');

let categories = JSON.parse(localStorage.getItem('finanza_cats') || 'null') || [
  { id: 'cat1', name: 'Alimentação', color: '#ff6b6b', emoji: '🍔' },
  { id: 'cat2', name: 'Transporte',  color: '#6bcbff', emoji: '🚗' },
  { id: 'cat3', name: 'Lazer',       color: '#d4a5ff', emoji: '🎮' },
  { id: 'cat4', name: 'Saúde',       color: '#a8edae', emoji: '💊' },
  { id: 'cat5', name: 'Moradia',     color: '#ffb347', emoji: '🏠' },
  { id: 'cat6', name: 'Outros',      color: '#a7a3bc', emoji: '📦' },
];

let editingExpenseId = null;
let currentImage = null;
let pieChart = null;

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// ===== PERSIST =====
function save() {
  localStorage.setItem('finanza_expenses', JSON.stringify(expenses));
  localStorage.setItem('finanza_cats', JSON.stringify(categories));
}

// ===== MONTH NAVIGATION =====
function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  update();
}

function getMonthExpenses() {
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  return expenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear() === y && d.getMonth() === m;
  });
}

// ===== MASTER UPDATE =====
function update() {
  document.getElementById('monthLabel').textContent =
    MONTHS[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
  updateSummary();
  renderChart();
  renderBreakdown();
  renderExpenses();
  renderFilterSelect();
}

// ===== SUMMARY CARDS =====
function updateSummary() {
  const list  = getMonthExpenses();
  const total = list.reduce((sum, e) => sum + e.amount, 0);
  const cats  = [...new Set(list.map(e => e.catId))].length;
  const max   = list.length ? list.reduce((a, b) => (a.amount > b.amount ? a : b)) : null;
  const avg   = list.length ? total / list.length : 0;

  document.getElementById('totalValue').textContent    = fmt(total);
  document.getElementById('totalCount').textContent    = list.length + (list.length === 1 ? ' gasto' : ' gastos');
  document.getElementById('activeCats').textContent    = cats;
  document.getElementById('topCatSub').textContent     = cats ? 'categorias usadas' : 'sem gastos';
  document.getElementById('maxExpense').textContent    = max ? fmt(max.amount) : 'R$ 0,00';
  document.getElementById('maxExpenseName').textContent = max ? max.name : '—';
  document.getElementById('avgExpense').textContent    = fmt(avg);
}

// ===== DOUGHNUT CHART =====
function renderChart() {
  const list = getMonthExpenses();
  const catTotals = {};

  list.forEach(e => {
    catTotals[e.catId] = (catTotals[e.catId] || 0) + e.amount;
  });

  const labels = [];
  const data   = [];
  const colors = [];

  Object.entries(catTotals).forEach(([id, val]) => {
    const cat = categories.find(c => c.id === id);
    if (cat) {
      labels.push(cat.emoji + ' ' + cat.name);
      data.push(val);
      colors.push(cat.color);
    }
  });

  if (pieChart) pieChart.destroy();

  const ctx = document.getElementById('pieChart').getContext('2d');

  if (!data.length) {
    ctx.clearRect(0, 0, 400, 400);
    pieChart = null;
    return;
  }

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: '#1a1828',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#a7a3bc',
            font: { family: 'DM Sans', size: 11 },
            padding: 12,
            boxWidth: 10,
            boxHeight: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmt(ctx.parsed),
          },
          backgroundColor: '#231f35',
          titleColor: '#fff',
          bodyColor: '#a7a3bc',
          borderColor: 'rgba(255,255,255,0.07)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
        },
      },
    },
  });
}

// ===== CATEGORY BREAKDOWN BARS =====
function renderBreakdown() {
  const list  = getMonthExpenses();
  const total = list.reduce((sum, e) => sum + e.amount, 0);
  const catTotals = {};

  list.forEach(e => {
    catTotals[e.catId] = (catTotals[e.catId] || 0) + e.amount;
  });

  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('catBreakdown');

  if (!sorted.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:0.85rem;padding:20px 0">Nenhum gasto neste mês.</div>';
    return;
  }

  el.innerHTML = sorted.map(([id, val]) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return '';
    const pct = total ? Math.round((val / total) * 100) : 0;
    return `
      <div class="cat-bar-item">
        <div class="cat-bar-header">
          <span class="cat-bar-name">
            <span style="width:8px;height:8px;border-radius:50%;background:${cat.color};display:inline-block"></span>
            ${cat.emoji} ${cat.name}
          </span>
          <span class="cat-bar-amount">${fmt(val)} · ${pct}%</span>
        </div>
        <div class="cat-bar-track">
          <div class="cat-bar-fill" style="width:${pct}%;background:${cat.color}"></div>
        </div>
      </div>`;
  }).join('');
}

// ===== EXPENSE LIST =====
function renderExpenses() {
  const filterCat = document.getElementById('filterCat').value;
  const sortBy    = document.getElementById('sortBy').value;
  let list = getMonthExpenses();

  if (filterCat) {
    list = list.filter(e => e.catId === filterCat);
  }

  list.sort((a, b) => {
    if (sortBy === 'date-desc')   return new Date(b.date) - new Date(a.date);
    if (sortBy === 'date-asc')    return new Date(a.date) - new Date(b.date);
    if (sortBy === 'amount-desc') return b.amount - a.amount;
    if (sortBy === 'amount-asc')  return a.amount - b.amount;
    return 0;
  });

  const el = document.getElementById('expenseList');

  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <div class="empty-text">Nenhum gasto encontrado neste período.</div>
      </div>`;
    return;
  }

  el.innerHTML = list.map(e => {
    const cat     = categories.find(c => c.id === e.catId);
    const dateStr = new Date(e.date + 'T00:00:00').toLocaleDateString('pt-BR');
    const thumb   = e.image
      ? `<div class="expense-thumb"><img src="${e.image}" alt="" /></div>`
      : `<div class="expense-thumb">${cat ? cat.emoji : '📦'}</div>`;

    return `
      <li class="expense-item">
        ${thumb}
        <div class="expense-info">
          <div class="expense-name">${esc(e.name)}</div>
          <div class="expense-meta">
            <span class="expense-date">${dateStr}</span>
            ${cat ? `<span class="expense-cat" style="border-color:${cat.color}40;color:${cat.color}">${cat.name}</span>` : ''}
            ${e.note ? `<span class="expense-note">${esc(e.note)}</span>` : ''}
          </div>
        </div>
        <div class="expense-amount">− ${fmt(e.amount)}</div>
        <div class="expense-actions">
          <button class="icon-btn edit"   onclick="editExpense('${e.id}')"   title="Editar">✏️</button>
          <button class="icon-btn delete" onclick="deleteExpense('${e.id}')" title="Excluir">🗑️</button>
        </div>
      </li>`;
  }).join('');
}

function renderFilterSelect() {
  const sel = document.getElementById('filterCat');
  const val = sel.value;
  sel.innerHTML =
    '<option value="">Todas as categorias</option>' +
    categories.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
  sel.value = val;
}

// ===== EXPENSE MODAL =====
function openExpenseModal(id = null) {
  editingExpenseId = id;
  currentImage = null;

  document.getElementById('expenseId').value = id || '';
  document.getElementById('expenseModalTitle').textContent = id ? 'Editar Gasto' : 'Novo Gasto';

  // Populate category select
  const catSel = document.getElementById('expenseCat');
  catSel.innerHTML = categories.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');

  // Reset fields
  document.getElementById('expenseName').value   = '';
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseDate').value   = new Date().toISOString().split('T')[0];
  document.getElementById('expenseNote').value   = '';
  resetImageUpload();

  // Fill with existing data when editing
  if (id) {
    const e = expenses.find(x => x.id === id);
    if (e) {
      document.getElementById('expenseName').value   = e.name;
      document.getElementById('expenseAmount').value = e.amount;
      document.getElementById('expenseDate').value   = e.date;
      document.getElementById('expenseNote').value   = e.note || '';
      document.getElementById('expenseCat').value    = e.catId;
      if (e.image) {
        currentImage = e.image;
        showImagePreview(e.image);
      }
    }
  }

  document.getElementById('expenseOverlay').classList.add('open');
}

function closeExpenseModal() {
  document.getElementById('expenseOverlay').classList.remove('open');
}

function saveExpense() {
  const name   = document.getElementById('expenseName').value.trim();
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const date   = document.getElementById('expenseDate').value;
  const catId  = document.getElementById('expenseCat').value;
  const note   = document.getElementById('expenseNote').value.trim();

  if (!name)               return toast('Informe o nome do gasto', 'error');
  if (!amount || amount <= 0) return toast('Informe um valor válido', 'error');
  if (!date)               return toast('Informe a data', 'error');
  if (!catId)              return toast('Selecione uma categoria', 'error');

  if (editingExpenseId) {
    const idx = expenses.findIndex(e => e.id === editingExpenseId);
    if (idx >= 0) {
      expenses[idx] = { ...expenses[idx], name, amount, date, catId, note, image: currentImage };
    }
    toast('Gasto atualizado!', 'success');
  } else {
    expenses.push({ id: 'e' + Date.now(), name, amount, date, catId, note, image: currentImage });
    toast('Gasto adicionado!', 'success');
  }

  save();
  closeExpenseModal();
  update();
}

function editExpense(id) {
  openExpenseModal(id);
}

function deleteExpense(id) {
  if (!confirm('Excluir este gasto?')) return;
  expenses = expenses.filter(e => e.id !== id);
  save();
  update();
  toast('Gasto excluído', 'success');
}

// ===== IMAGE UPLOAD =====
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentImage = e.target.result;
    showImagePreview(currentImage);
  };
  reader.readAsDataURL(file);
}

function showImagePreview(src) {
  document.getElementById('imageUploadContent').innerHTML =
    `<img src="${src}" class="image-preview" alt="preview" />
     <div class="image-upload-text" style="font-size:0.78rem">Toque para trocar</div>`;
}

function resetImageUpload() {
  document.getElementById('imageUploadContent').innerHTML =
    `<div class="image-upload-icon">📷</div>
     <div class="image-upload-text">Toque para adicionar uma foto</div>`;
  document.getElementById('imageInput').value = '';
  currentImage = null;
}

// ===== CATEGORY MODAL =====
function openCatModal() {
  renderCatList();
  document.getElementById('catOverlay').classList.add('open');
}

function closeCatModal() {
  document.getElementById('catOverlay').classList.remove('open');
}

function renderCatList() {
  document.getElementById('catList').innerHTML = categories.map(c => `
    <div class="cat-chip">
      <span class="cat-chip-dot" style="background:${c.color}"></span>
      <span>${c.emoji} ${c.name}</span>
      <button class="cat-chip-del" onclick="deleteCategory('${c.id}')" title="Remover">✕</button>
    </div>
  `).join('');
}

function addCategory() {
  const name  = document.getElementById('newCatName').value.trim();
  const color = document.getElementById('newCatColor').value;

  if (!name) return toast('Informe o nome da categoria', 'error');
  if (categories.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    return toast('Categoria já existe', 'error');
  }

  const emojis = ['🛒', '✈️', '🎬', '💪', '📱', '🎓', '💼', '🏖️', '🎁', '⚡'];
  categories.push({
    id: 'cat' + Date.now(),
    name,
    color,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
  });

  document.getElementById('newCatName').value = '';
  save();
  renderCatList();
  update();
  toast('Categoria adicionada!', 'success');
}

function deleteCategory(id) {
  const inUse = expenses.some(e => e.catId === id);
  if (inUse && !confirm('Esta categoria tem gastos. Excluir mesmo assim?')) return;
  categories = categories.filter(c => c.id !== id);
  save();
  renderCatList();
  update();
  toast('Categoria removida', 'success');
}

// ===== UTILITIES =====
function fmt(v) {
  return 'R$ ' + (v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = (type === 'success' ? '✅' : '❌') + ' ' + msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ===== OVERLAY BACKDROP CLOSE =====
document.getElementById('expenseOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeExpenseModal();
});

document.getElementById('catOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeCatModal();
});

// ===== INIT =====
update();
