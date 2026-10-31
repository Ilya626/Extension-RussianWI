import { NAME_CASES, suggestName } from './name-declension.js';

const canonical = value => value.trim().toLocaleLowerCase('ru');
export function nameDrafts(root) {
    return new Map([...root.querySelectorAll('[data-rwi-name]')].map(box => [box.dataset.rwiDraftKey, {
        values: [...box.querySelectorAll('input')].map(input => input.value), baseline: box.dataset.saved,
    }]));
}

export function nameEditor(word, { getSettings, save, refresh, draft, draftKey }) {
    const key = canonical(word.word), config = getSettings().names?.[key];
    const proposal = word.name || suggestName(word.word, { gender: 'off' });
    const box = document.createElement('div'); box.className = 'rwi-name-editor'; box.dataset.rwiName = key;
    box.dataset.rwiDraftKey = draftKey;
    const label = document.createElement('label'); label.className = 'rwi-editor-label'; label.textContent = 'Склонение имени';
    const select = document.createElement('select'); select.className = 'text_pole';
    for (const [value, title] of [['auto', 'Автоматически — первоначальное предложение'], ['male', 'Мужское имя'],
        ['female', 'Женское имя'], ['fixed', 'Несклоняемое имя'], ['off', 'Не имя — только словарь / исходный ключ']]) select.append(new Option(title, value));
    select.value = config?.gender || 'auto'; label.append(select); box.append(label);
    const hint = document.createElement('small'); hint.className = 'rwi-hint';
    hint.textContent = proposal.manual ? 'Ваши падежные формы.' : word.name ? `Предложение: ${proposal.gender === 'male' ? 'мужской род' : proposal.gender === 'female' ? 'женский род' : 'без склонения'}. Можно изменить род или любую форму.`
        : 'Автопредложение не применяется: ключ уже имеет ручные формы либо не выглядит как имя. Род можно выбрать явно.';
    box.append(hint);
    const grid = document.createElement('div'); grid.className = 'rwi-name-cases';
    const values = draft && JSON.stringify(draft.values) !== draft.baseline ? draft.values : proposal.cases;
    const inputs = NAME_CASES.map((title, index) => {
        const label = document.createElement('label'); label.textContent = title;
        const input = document.createElement('input'); input.type = 'text'; input.className = 'text_pole'; input.value = values[index];
        input.disabled = ['off', 'fixed'].includes(select.value); label.append(input); grid.append(label); return input;
    });
    box.dataset.saved = JSON.stringify(proposal.cases); box.append(grid);
    const actions = document.createElement('div'); actions.className = 'rwi-editor-actions';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'menu_button'; button.textContent = 'Сохранить поправки';
    button.disabled = ['off', 'fixed'].includes(select.value);
    const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'menu_button'; reset.textContent = 'Предложить заново';
    const commit = forms => {
        const s = getSettings(); s.names ??= {};
        if (select.value === 'auto' && !forms) delete s.names[key];
        else s.names[key] = { gender: select.value, ...(forms ? { forms } : {}) };
        box.dataset.saved = JSON.stringify(inputs.map(input => input.value));
        save(); refresh();
    };
    button.addEventListener('click', () => commit(inputs.map((input, index) => input.value.trim() || proposal.cases[index])));
    // Choosing another gender or explicitly regenerating replaces the proposal.
    select.addEventListener('change', () => commit()); reset.addEventListener('click', () => commit());
    actions.append(button, reset); box.append(actions); return box;
}
