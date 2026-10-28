import { loadDictionary, compileKey, expandEntries, clearCompiledKeys } from './morphology.js';

const KEY = 'russianWIForms';
const defaults = { enabled: true, allBooks: true, books: [], foldYo: true, excludedKeys: [], aliases: {}, senses: {} };
const canonical = text => text.trim().toLocaleLowerCase('ru');
const status = text => $('#rwi_status').text(text);
let nativeWI;
let matchingErrorReported = false;

function settings() {
    const stored = SillyTavern.getContext().extensionSettings[KEY] ??= {};
    for (const [key, value] of Object.entries(defaults)) if (stored[key] === undefined) stored[key] = structuredClone(value);
    return stored;
}

function save() {
    clearCompiledKeys();
    SillyTavern.getContext().saveSettingsDebounced();
}

function renderSettings(initial = false) {
    const s = settings();
    $('#rwi_enabled').prop('checked', s.enabled);
    $('#rwi_all_books').prop('checked', s.allBooks);
    $('#rwi_fold_yo').prop('checked', s.foldYo);
    $('#rwi_books_row').prop('hidden', s.allBooks);
    const books = document.getElementById('rwi_books'); books.replaceChildren();
    for (const name of new Set([...(nativeWI.world_names || []), ...s.books])) {
        const option = new Option(name, name, false, s.books.includes(name)); books.append(option);
    }
    if (initial) {
        $('#rwi_excluded').val(s.excludedKeys.join('\n'));
        $('#rwi_aliases').val(Object.entries(s.aliases).map(([key, forms]) => `${key} = ${forms.join(', ')}`).join('\n'));
    }
}

async function preview() {
    const s = settings(), key = $('#rwi_preview_key').val();
    const result = await compileKey(key, s);
    const body = document.getElementById('rwi_word_choices'); body.replaceChildren();
    $('#rwi_generated').text(result.key);
    const regex = nativeWI.parseRegexFromString(result.key);
    const text = $('#rwi_example').val();
    const matches = regex ? regex.test(text) : canonical(text).includes(canonical(result.key));
    $('#rwi_match').text((!s.enabled ? 'Preview only — word forms are disabled for real scans. ' : '')
        + (matches ? 'Match — this keyword can activate the entry.' : 'No match.'));
    for (const word of result.words) {
        const row = document.createElement('div'); row.className = 'rwi-word';
        const title = document.createElement('strong'); title.textContent = word.word; row.append(title);
        if (word.choices.length > 1 || s.senses[canonical(word.word)]) {
            const select = document.createElement('select'); select.className = 'text_pole';
            select.append(new Option('Keep literal — choose a meaning to expand', ''));
            for (const choice of word.choices) select.append(new Option(`${choice.lemma} · ${choice.pos} · ${choice.forms.length} forms`, choice.id));
            select.value = s.senses[canonical(word.word)] || '';
            select.addEventListener('change', () => {
                if (select.value) s.senses[canonical(word.word)] = select.value;
                else delete s.senses[canonical(word.word)];
                save(); preview().catch(report);
            });
            row.append(select);
        }
        const forms = document.createElement('p'); forms.className = 'rwi-forms';
        forms.textContent = word.choices.length ? word.forms.join(', ') : 'Not in the dictionary. Kept literal; manual forms are available below.';
        row.append(forms); body.append(row);
    }
}

function report(error) { console.error('[Russian WI Forms]', error); status(error.message); toastr.error(error.message, 'Russian WI Forms'); }

async function init() {
    const ctx = SillyTavern.getContext();
    nativeWI = await import('/scripts/world-info.js');
    $('#extensions_settings2').append(await ctx.renderExtensionTemplateAsync('third-party/Extension-RussianWI', 'settings', {}));
    for (const [id, key] of [['#rwi_enabled', 'enabled'], ['#rwi_all_books', 'allBooks'], ['#rwi_fold_yo', 'foldYo']]) {
        $(id).on('change', function () { settings()[key] = this.checked; save(); renderSettings(); });
    }
    $('#rwi_books').on('change', function () { settings().books = [...this.selectedOptions].map(option => option.value); save(); });
    $('#rwi_preview').on('click', () => preview().catch(report));
    $('#rwi_save_exceptions').on('click', () => {
        try {
            const aliases = {};
            for (const line of $('#rwi_aliases').val().split(/\r?\n/).filter(line => line.trim())) {
                const split = line.indexOf('=');
                if (split <= 0) throw new Error('Use: original key = form, another form');
                const forms = line.slice(split + 1).split(',').map(form => form.trim()).filter(Boolean);
                if (!forms.length) throw new Error('Add at least one form after =');
                aliases[canonical(line.slice(0, split))] = [...new Set(forms)];
            }
            const s = settings(); s.aliases = aliases;
            s.excludedKeys = $('#rwi_excluded').val().split(/\r?\n/).map(key => key.trim()).filter(Boolean);
            save(); status('Exceptions and manual forms saved.'); preview().catch(report);
        } catch (error) { report(error); }
    });
    ctx.eventSource.on(ctx.eventTypes.WORLDINFO_ENTRIES_LOADED, async payload => {
        if (!settings().enabled) return;
        try {
            await expandEntries(payload, structuredClone(settings()), nativeWI.world_info_case_sensitive);
            matchingErrorReported = false;
        } catch (error) {
            status('Word forms unavailable. ST is using the original WI keys.');
            if (!matchingErrorReported) { console.error('[Russian WI Forms]', error); toastr.warning('Word forms unavailable; original WI keys were kept.', 'Russian WI Forms'); }
            matchingErrorReported = true;
        }
    });
    for (const event of [ctx.eventTypes.WORLDINFO_UPDATED, ctx.eventTypes.CHAT_CHANGED].filter(Boolean)) ctx.eventSource.on(event, () => renderSettings());
    renderSettings(true);
    await loadDictionary();
    status('Dictionary ready. Forms are generated locally; no model requests.');
    console.info('[Russian WI Forms] 0.1.0 loaded');
}

init().catch(report);
