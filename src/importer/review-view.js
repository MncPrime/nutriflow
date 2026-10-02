import { CATEGORY_LABELS } from './food-classifier.js';

const CONFIDENCE = { high: 'Confiança alta', medium: 'Confiança média', low: 'Precisa de revisão' };
const UNITS = [['g', 'g'], ['ml', 'ml'], ['un', 'un'], ['fatias', 'fatias']];
const icon = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const ICONS = {
  pdf: icon('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  text: icon('<path d="M5 6h14M5 12h14M5 18h9"/>'),
  manual: icon('<path d="M12 5v14M5 12h14"/>'),
  trash: icon('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
};

export function renderChooser(state, esc) {
  const card = (mode, ico, title, text, extra = '', disabled = false) =>
    `<button type="button" class="imp-opt${extra}" ${disabled ? 'disabled aria-disabled="true"' : `onclick="importPick('${mode}')"`}><span class="imp-ico">${ico}</span><span class="imp-txt"><b>${title}</b><small>${text}</small></span>${disabled ? '<em class="imp-soon">Em breve</em>' : ''}</button>`;
  return `<h3>Importar plano alimentar</h3><p class="plan-editor-hint">Como deseja adicionar seu plano? Nada é salvo antes da sua confirmação.</p>
  ${state.error ? `<p class="warn" role="alert">${esc(state.error)}</p>` : ''}
  ${state.pdfError ? `<p class="warn" role="status">${esc(state.pdfError)}</p>` : ''}
  ${state.loading ? `<div class="capture-loading" role="status"><svg class="saving-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" opacity=".25"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Lendo ${esc(state.fileName || 'documento')}…</span></div>` : ''}
  <div class="imp-opts">
    ${card('text', ICONS.text, 'Colar texto', 'Cole o plano recebido por WhatsApp, e-mail ou outro documento.')}
    ${card('manual', ICONS.manual, 'Montar manualmente', 'Adicione refeições e alimentos passo a passo.')}
  </div>
  <div class="capture-input"><label class="capture-label" for="tx">Ou cole seu plano abaixo</label>
  <textarea id="tx" aria-label="Plano em texto" placeholder="Café da manhã | 06:00&#10;1 un banana ou 150g mamão&#10;3 ovos mexidos">${esc(state.text)}</textarea></div>
  <div class="capture-actions"><button class="p" type="button" onclick="importInterpret()">Interpretar plano</button></div>
  <details class="plan-editor"><summary>Ajuda e exemplo</summary><p class="plan-editor-hint">Uma refeição por título (ex.: “Almoço | 12:00”), um alimento por linha, “ou” entre substituições e “+” para vários itens. Entendemos g, kg, ml, litros, un e fatias.</p><button class="s" type="button" onclick="loadExampleCapture()">Usar exemplo</button></details>`;
}

export function renderScheduleChooser(state, esc) {
  return `<h3>Escolha a rotina do plano</h3><p class="plan-editor-hint">Este PDF contém mais de uma rotina. Importe uma por vez para não somar refeições de horários alternativos.</p>
  ${state.error ? `<p class="warn" role="alert">${esc(state.error)}</p>` : ''}
  <div class="imp-opts">${state.pdfSchedules.map((schedule, index) => {
    const meals = (schedule.text.match(/^# /gm) || []).length;
    return `<button type="button" class="imp-opt" onclick="importChooseSchedule(${index})"><span class="imp-ico">${ICONS.pdf}</span><span class="imp-txt"><b>${esc(schedule.name)}</b><small>${meals} refeições · importar esta rotina</small></span></button>`;
  }).join('')}</div>
  <button type="button" class="s" onclick="importBack()">Cancelar</button>`;
}

function renderAlt(alt, esc) {
  const level = alt.confidence || 'high';
  return `<div class="imp-alt imp-${level}"><div class="imp-alt-main">
    <input class="imp-name" value="${esc(alt.name)}" aria-label="Alimento" onchange="importEdit('${alt.id}','name',this.value)">
    <div class="imp-qty"><input value="${alt.quantity ?? ''}" inputmode="decimal" placeholder="Qtd" aria-label="Quantidade" onchange="importEdit('${alt.id}','quantity',this.value)">
    <select aria-label="Unidade" onchange="importEdit('${alt.id}','unit',this.value)">${UNITS.map(([v, l]) => `<option value="${v}" ${alt.unit === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
    <button class="imp-del" type="button" aria-label="Remover ${esc(alt.name)}" onclick="importRemove('${alt.id}')">${ICONS.trash}</button></div></div>
    <div class="imp-meta"><span class="imp-badge">${CONFIDENCE[level]}</span><span class="imp-cat">${CATEGORY_LABELS[alt.category] || ''}${alt.preparation ? ` · ${esc(alt.preparation)}` : ''}</span></div>
    ${alt.issues?.length ? `<ul class="imp-issues">${alt.issues.map(issue => `<li>${esc(issue)}</li>`).join('')}</ul>` : ''}</div>`;
}

export function renderReview(state, esc) {
  const { draft, stats } = state;
  const meals = draft.meals.map(meal => `<section class="imp-meal"><div class="imp-mh"><input class="imp-mname" value="${esc(meal.name)}" aria-label="Nome da refeição" onchange="importMeal('${meal.id}','name',this.value)"><input class="imp-mtime" type="time" value="${esc(meal.time)}" aria-label="Horário" onchange="importMeal('${meal.id}','time',this.value)"><button class="imp-del" type="button" aria-label="Remover refeição" onclick="importRemoveMeal('${meal.id}')">${ICONS.trash}</button></div>
    ${meal.opts.map(opt => `${opt.name ? `<div class="oh">${esc(opt.name)}</div>` : ''}${opt.entries.map(entry => entry.alts.length > 1
      ? `<div class="imp-group"><div class="imp-group-label">Grupo de substituição</div>${entry.alts.map((alt, i) => `${i ? '<div class="imp-or">OU</div>' : ''}${renderAlt(alt, esc)}`).join('')}</div>`
      : renderAlt(entry.alts[0], esc)).join('')}`).join('')}
    ${meal.notes.length ? `<p class="imp-notes">${meal.notes.map(esc).join(' · ')}</p>` : ''}</section>`).join('');
  return `<h3>Plano identificado</h3>
  <p class="imp-stats" aria-live="polite"><b>${stats.meals}</b> refeição(ões) · <b>${stats.foods}</b> alimento(s) · <b>${stats.groups}</b> grupo(s) de substituição</p>
  ${stats.review ? `<p class="warn" role="status">${stats.review} item(ns) precisam de revisão. ${stats.blocked ? `${stats.blocked} sem quantidade válida ficarão de fora até serem corrigidos.` : ''}</p>` : ''}
  ${state.error ? `<p class="warn" role="alert">${esc(state.error)}</p>` : ''}
  ${meals || '<div class="empty">Nenhuma refeição reconhecida. Volte e confira o texto.</div>'}
  <div class="capture-preview-actions"><button class="s" type="button" onclick="importBack()">Voltar</button><button class="p" type="button" onclick="importConfirm()" ${stats.foods - stats.blocked > 0 || stats.meals && stats.foods > stats.blocked ? '' : 'disabled'}>Confirmar e aplicar</button></div>`;
}

export function renderManual(state, esc, meals, suggestions) {
  const preview = state.quickPreview;
  const alts = preview?.flatMap(entry => entry.alts) || [];
  const understood = preview ? `<div class="imp-understood" aria-live="polite"><b>Entendi:</b>${preview.map(entry => `<div>${entry.alts.map(alt => `<span>${esc(alt.name || '—')} · ${alt.quantity ? `${alt.quantity} ${alt.unit}` : '<em>quantidade não identificada</em>'} · ${CATEGORY_LABELS[alt.category]}</span>`).join(' <i>ou</i> ')}</div>`).join('')}</div>` : '';
  const ok = alts.length && alts.every(alt => alt.valid);
  return `<h3>Adicionar alimentos</h3>
  <p class="manual-intro">Escolha a refeição e informe os alimentos e as quantidades do seu plano. Nada será aplicado sem sua confirmação.</p>
  ${state.error ? `<p class="warn" role="alert">${esc(state.error)}</p>` : ''}
  <section class="manual-section" aria-labelledby="manual-meal-heading">
    <h4 id="manual-meal-heading">1. Refeição</h4>
    <label for="imp-meal">Onde adicionar?</label>
    <select id="imp-meal" onchange="importMealSelect(this.value)"><option value="new" ${!state.manualMeal || state.manualMeal === 'new' ? 'selected' : ''}>Criar uma nova refeição</option>${meals.map(meal => `<option value="${meal.id}" ${state.manualMeal === meal.id ? 'selected' : ''}>${esc(meal.name)}</option>`).join('')}</select>
    ${!state.manualMeal || state.manualMeal === 'new' ? `<label for="imp-new-meal">Nome da refeição</label><input id="imp-new-meal" value="${esc(state.manualMealName || '')}" placeholder="Ex.: Café da manhã" autocomplete="off" oninput="importMealName(this.value)">` : `<p class="manual-selected">O alimento será incluído em <b>${esc(meals.find(meal => meal.id === state.manualMeal)?.name || '')}</b>.</p>`}
  </section>
  <section class="manual-section" aria-labelledby="manual-food-heading">
    <h4 id="manual-food-heading">2. Alimento e quantidade</h4>
    <label for="imp-quick">Nome do alimento</label>
    <input id="imp-quick" value="${esc(state.quick)}" placeholder="Ex.: frango grelhado" autocomplete="off" oninput="importQuick(this.value)" aria-describedby="manual-food-help">
    <small id="manual-food-help" class="manual-help">Você também pode informar tudo de uma vez, como “150g frango grelhado”.</small>
  ${suggestions.length ? `<div class="food-suggestions">${suggestions.map(food => `<button type="button" class="suggestion-item" onclick="importPickFood('${esc(food.label).replace(/'/g, '&#39;')}')">${esc(food.label)}</button>`).join('')}</div>` : ''}
    <div class="manual-quantity"><label for="imp-qty">Quantidade</label><div class="manual-quantity-row"><input id="imp-qty" value="${esc(state.manualQuantity || '')}" inputmode="decimal" placeholder="Ex.: 150" oninput="importQuick()" aria-label="Quantidade"><select id="imp-unit" aria-label="Unidade" onchange="importQuick()">${UNITS.map(([v, l]) => `<option value="${v}" ${state.manualUnit === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <p class="manual-help">Use g, ml, unidade ou fatias. Se digitar a quantidade junto ao alimento, estes campos podem ficar vazios.</p>
    <details class="manual-category" ${state.manualCategoryOpen ? 'open' : ''} ontoggle="importCategoryOpen(this.open)"><summary>Categoria do alimento (opcional)</summary>
      <div class="chips imp-cats">${['protein', 'carbohydrate', 'fruit', 'vegetable', 'dairy', 'fat', 'beverage', 'supplement', 'other'].map(c => `<button type="button" class="chip" aria-pressed="${state.guidedCategory === c}" onclick="importCategory('${c}')">${CATEGORY_LABELS[c]}</button>`).join('')}</div>
    </details>
  </section>
  ${understood}
  <div class="capture-preview-actions"><button class="s" type="button" onclick="importBack()">Voltar</button><button class="p" type="button" onclick="importAddManual()" ${ok ? '' : 'disabled'}>Adicionar alimento${alts.length > 1 ? 's' : ''}</button></div>`;
}
