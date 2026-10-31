export const NAME_CASES = ['Именительный · кто?', 'Родительный · кого?', 'Дательный · кому?',
    'Винительный · кого?', 'Творительный · кем?', 'Предложный · о ком?'];

export function suggestName(word, config, enabled = true) {
    if (!/^[а-яё]+$/iu.test(word) || (!config && (!enabled || !/^[А-ЯЁ]/u.test(word)))) return null;
    const lower = word.toLocaleLowerCase('ru');
    const inferred = /[ая]$/u.test(lower) ? 'female' : /[бвгджзйклмнпрстфхцчшщь]$/u.test(lower) ? 'male' : 'fixed';
    const mode = config?.gender || 'auto', gender = mode === 'auto' ? inferred : mode;
    const stem = lower.slice(0, -1);
    let forms = Array(6).fill(lower);
    if (gender !== 'fixed' && gender !== 'off') {
        if (lower.endsWith('а')) forms = [lower, stem + (/[гкхжчшщ]$/u.test(stem) ? 'и' : 'ы'), stem + 'е', stem + 'у',
            stem + (/[жчшщц]$/u.test(stem) ? 'ей' : 'ой'), stem + 'е'];
        else if (lower.endsWith('я')) forms = [lower, stem + 'и', stem + (lower.endsWith('ия') ? 'и' : 'е'), stem + 'ю', stem + 'ей', stem + (lower.endsWith('ия') ? 'и' : 'е')];
        else if (gender === 'male' && /[йь]$/u.test(lower)) forms = [lower, stem + 'я', stem + 'ю', stem + 'я', stem + 'ем', stem + (lower.endsWith('ий') ? 'и' : 'е')];
        else if (gender === 'male' && /[бвгджзклмнпрстфхцчшщ]$/u.test(lower)) forms = [lower, lower + 'а', lower + 'у', lower + 'а',
            lower + (/[жчшщц]$/u.test(lower) ? 'ем' : 'ом'), lower + 'е'];
        // Foreign female names ending in a consonant stay unchanged by default.
    }
    const capitalized = form => word === word.toLocaleUpperCase('ru') ? form.toLocaleUpperCase('ru')
        : /^[А-ЯЁ]/u.test(word) ? form[0].toLocaleUpperCase('ru') + form.slice(1) : form;
    const cases = config?.forms?.length === 6 ? config.forms.map((form, index) => form.trim() || capitalized(forms[index])) : forms.map(capitalized);
    return { mode, gender, manual: config?.forms?.length === 6, cases, forms: [...new Set([word, ...cases])] };
}
