import { NAME_CASES, suggestName } from './name-declension.js';

const canonical = value => value.trim().toLocaleLowerCase('ru');
export function nameDrafts(root) {
    return new Map([...root.querySelectorAll('[data-rwi-name]')].map(box => [box.dataset.rwiDraftKey, {
        values: [...box.querySelectorAll('.rwi-name-cases input')].map(input => input.value), baseline: box.dataset.saved,
    }]));
}

export function nameEditor(word, { getSettings, save, refresh, draft, draftKey }) {
    const key = canonical(word.word), config = getSettings().names?.[key];
    const proposal = word.name || suggestName(word.word, { gender: 'auto' });
    const box = document.createElement('div'); box.className = 'rwi-name-editor'; box.dataset.rwiName = key;
    box.dataset.rwiDraftKey = draftKey;
    const toggleLabel = document.createElement('label'); toggleLabel.className = 'checkbox_label rwi-name-toggle';
    const toggle = document.createElement('input'); toggle.type = 'checkbox';
    toggle.checked = !!word.name && word.name.mode !== 'off';
    toggleLabel.append(toggle, document.createTextNode('Имя')); box.append(toggleLabel);
    const controls = document.createElement('div'); controls.className = 'rwi-name-controls'; controls.hidden = !toggle.checked;
    const label = document.createElement('label'); label.className = 'rwi-editor-label'; label.textContent = 'Склонение имени';
    const select = document.createElement('select'); select.className = 'text_pole';
    for (const [value, title] of [['auto', 'Автоматически — первоначальное предложение'], ['male', 'Мужское имя'],
        ['female', 'Женское имя'], ['fixed', 'Несклоняемое имя']]) select.append(new Option(title, value));
    select.value = config?.gender === 'off' ? config.nameGender || 'auto' : config?.gender || 'auto'; label.append(select); controls.append(label);
    const hint = document.createElement('small'); hint.className = 'rwi-hint';
    hint.textContent = proposal.manual ? 'Ваши падежные формы.' : word.name ? `Предложение: ${proposal.gender === 'male' ? 'мужской род' : proposal.gender === 'female' ? 'женский род' : 'без склонения'}. Можно изменить род или любую форму.`
        : 'Автопредложение не применяется: ключ уже имеет ручные формы либо не выглядит как имя. Род можно выбрать явно.';
    if (!toggle.checked) hint.textContent = 'Для имени — род и 6 падежей. Без отметки работают словарь и ручные формы; поправки имени сохраняются.';
    box.append(hint, controls);
    const grid = document.createElement('div'); grid.className = 'rwi-name-cases';
    const values = draft && JSON.stringify(draft.values) !== draft.baseline ? draft.values : proposal.cases;
    const inputs = NAME_CASES.map((title, index) => {
        const label = document.createElement('label'); label.textContent = title;
        const input = document.createElement('input'); input.type = 'text'; input.className = 'text_pole'; input.value = values[index];
        input.disabled = ['off', 'fixed'].includes(select.value); label.append(input); grid.append(label); return input;
    });
    box.dataset.saved = JSON.stringify(proposal.cases); controls.append(grid);
    const actions = document.createElement('div'); actions.className = 'rwi-editor-actions';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'menu_button'; button.textContent = 'Сохранить поправки';
    button.disabled = ['off', 'fixed'].includes(select.value);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'menu_button'; reset.textContent = 'Предложить заново';
    const commit = forms => {
        const s = getSettings(); s.names ??= {};
        s.names[key] = { gender: select.value, ...(forms ? { forms } : {}) };
        box.dataset.saved = JSON.stringify(inputs.map(input => input.value));
        save(); refresh();
    };
    button.addEventListener('click', () => commit(inputs.map((input, index) => input.value.trim() || proposal.cases[index])));
    toggle.addEventListener('change', () => {
        const s = getSettings(); s.names ??= {};
        const current = s.names[key] || {};
        const gender = current.gender === 'off' ? current.nameGender || 'auto' : current.gender || 'auto';
        s.names[key] = toggle.checked ? { ...current, gender } : { ...current, gender: 'off', nameGender: gender };
        if (toggle.checked) delete s.names[key].nameGender;
        save(); refresh();
    });
    // Choosing another gender or explicitly regenerating replaces the proposal.
    select.addEventListener('change', () => commit()); reset.addEventListener('click', () => commit());
    actions.append(button, reset); controls.append(actions); return box;
}
