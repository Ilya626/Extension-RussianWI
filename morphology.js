let dictionary;
const words = new Map();
const compiled = new Map();
const canonical = text => text.trim().toLocaleLowerCase('ru');
const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

export async function loadDictionary() {
    if (!dictionary) dictionary = import('./vendor/az/az.min.js').then(({ default: Az }) => new Promise((resolve, reject) => {
        Az.Morph.init(new URL('./vendor/az/dicts', import.meta.url).href, error => error ? reject(error) : resolve(Az));
    })).catch(error => { dictionary = null; throw error; });
    return dictionary;
}

export function clearCompiledKeys() { compiled.clear(); }

export async function analyzeWord(word) {
    const lower = canonical(word);
    if (words.has(lower)) return words.get(lower);
    const Az = await loadDictionary();
    const groups = new Map();
    for (const parse of Az.Morph(lower, { parsers: ['Dictionary'], stutter: 0, typos: 0, ignoreCase: true })) {
        const normal = parse.normalize();
        const id = `${normal.word}|${normal.tag.POS}`;
        let group = groups.get(id);
        if (!group) groups.set(id, group = { id, lemma: normal.word, pos: normal.tag.POS, forms: new Set([lower]) });
        for (let i = 0; i < parse.formCnt; i++) group.forms.add(parse.inflect(i).toString());
    }
    const result = [...groups.values()].map(group => ({ ...group, forms: [...group.forms].sort() }));
    words.set(lower, result);
    return result;
}

function restoreCase(form, original) {
    if (original === original.toLocaleUpperCase('ru')) return form.toLocaleUpperCase('ru');
    if (original[0] === original[0].toLocaleUpperCase('ru')) return form[0].toLocaleUpperCase('ru') + form.slice(1);
    return form;
}

export async function compileKey(key, settings, caseSensitive = false) {
    if (typeof key !== 'string' || !/[а-яё]/iu.test(key) || key.includes('{{') || /^\/.+\/[a-z]*$/is.test(key)
        || settings.excludedKeys.some(item => canonical(item) === canonical(key))) return { source: key, key, words: [], changed: false };
    const signature = JSON.stringify([key, caseSensitive, settings.foldYo, settings.senses, settings.aliases]);
    if (compiled.has(signature)) return compiled.get(signature);
    const parts = [], details = [];
    let changed = false;
    for (const piece of key.split(/([а-яё]+)/iu)) {
        if (!piece) continue;
        if (!/^[а-яё]+$/iu.test(piece)) { parts.push(escapeRegex(piece).replace(/\s+/g, '\\s+')); continue; }
        const choices = await analyzeWord(piece);
        const selected = choices.find(choice => choice.id === settings.senses[canonical(piece)]) || (choices.length === 1 ? choices[0] : null);
        const forms = selected ? [...new Set(selected.forms.map(form => restoreCase(form, piece)))] : [piece];
        details.push({ word: piece, choices, selected: selected?.id || '', forms });
        if (forms.length > 1) changed = true;
        parts.push(`(?:${forms.map(form => escapeRegex(form)).join('|')})`);
    }
    const aliases = settings.aliases[canonical(key)] || [];
    if (aliases.length) changed = true;
    let pattern = [parts.join(''), ...aliases.map(alias => escapeRegex(alias).replace(/\s+/g, '\\s+'))].join('|');
    if (settings.foldYo) pattern = pattern.replace(/[ёе]/g, '[её]').replace(/[ЁЕ]/g, '[ЕЁ]');
    const value = changed ? `/(?:^|[^\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])/${caseSensitive ? 'u' : 'iu'}` : key;
    // Compile here as well, so a malformed user alias cannot reach ST's scanner.
    if (changed) new RegExp(value.slice(1, value.lastIndexOf('/')), value.slice(value.lastIndexOf('/') + 1));
    const result = { source: key, key: value, words: details, changed };
    if (compiled.size >= 2000) compiled.delete(compiled.keys().next().value);
    compiled.set(signature, result);
    return result;
}

export async function expandEntries(payload, settings, nativeCaseSensitive = false) {
    if (!settings.enabled) return 0;
    let count = 0;
    const changes = [];
    for (const name of ['globalLore', 'characterLore', 'chatLore', 'personaLore']) {
        const list = payload[name];
        if (!Array.isArray(list)) continue;
        for (let i = 0; i < list.length; i++) {
            const entry = list[i];
            if (!settings.allBooks && !settings.books.includes(entry.world)) continue;
            const copy = { ...entry };
            for (const field of ['key', 'keysecondary']) {
                if (!Array.isArray(entry[field])) continue;
                const original = entry[field];
                const expanded = await Promise.all(original.map(key => compileKey(key, settings, entry.caseSensitive ?? nativeCaseSensitive)));
                if (!expanded.some(key => key.changed)) continue;
                const keys = expanded.map(key => key.key);
                // ST hashes JSON before structuredClone. Hash original keys so sticky,
                // cooldown and delay keep the same entry identity; cloning drops this
                // non-enumerable method and passes the expanded strings to matching.
                Object.defineProperty(keys, 'toJSON', { value: () => original });
                copy[field] = keys;
                count += expanded.filter(key => key.changed).length;
            }
            changes.push([list, i, copy]);
        }
    }
    for (const [list, index, entry] of changes) list[index] = entry;
    return count;
}
