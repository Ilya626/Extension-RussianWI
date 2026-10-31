import { compileKey } from './morphology.js';

const canonical = text => text.trim().toLocaleLowerCase('ru');
const keySelector = 'select[name="key"], textarea[name="key"], select[name="keysecondary"], textarea[name="keysecondary"]';
const posNames = { NOUN: 'существительное', ADJF: 'прилагательное', ADJS: 'краткое прилагательное', VERB: 'глагол', INFN: 'инфинитив', ADVB: 'наречие', NPRO: 'местоимение', PRTF: 'причастие', PRTS: 'краткое причастие' };

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/** Read the native editor's active control; never write to the book or its inputs. */
export function installWorldInfoEditor({ nativeWI, getSettings, saveSettings, isReady }) {
    let timer;
    let revision = 0;
    const states = new WeakMap();
    const refresh = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            document.querySelectorAll('#world_popup_entries_list .keyprimary, #world_popup_entries_list .keysecondary')
                .forEach(container => render(container).catch(error => {
                    const panel = container.querySelector('.rwi-entry-forms');
                    if (panel) panel.textContent = `Русские формы: ${error.message}`;
                    console.error('[Russian WI Forms editor]', error);
                }));
        }, 120);
    };

    function readKeys(container) {
        const select = container.querySelector('select.keyselect');
        if (select?.classList.contains('select2-hidden-accessible')) return [...select.selectedOptions].map(option => option.text);
        const textarea = container.querySelector('textarea[name]');
        if (textarea && textarea.style.display !== 'none') return nativeWI.splitKeywordsAndRegexes(textarea.value);
        return select ? [...select.selectedOptions].map(option => option.text) : [];
    }

    async function render(container) {
        const keys = readKeys(container);
        const s = getSettings();
        const bookSelect = document.querySelector('#world_editor_select');
        const book = nativeWI.world_names?.[Number(bookSelect?.value)];
        const active = s.enabled && (s.allBooks || s.books.includes(book));
        const caseValue = container.closest('.world_entry')?.querySelector('select[name="caseSensitive"]')?.value;
        const caseSensitive = caseValue === 'true' ? true : caseValue === 'false' ? false : nativeWI.world_info_case_sensitive;
        const signature = JSON.stringify([keys, active, s.foldYo, s.aliases, s.senses, s.excludedKeys, caseSensitive, isReady()]);
        let state = states.get(container);
        if (state?.signature === signature) return;
        if (!state) {
            const panel = element('div', 'rwi-entry-forms');
            panel.setAttribute('aria-label', 'Русские формы ключей');
            container.append(panel);
            state = { panel };
            states.set(container, state);
        }
        state.signature = signature;
        const request = state.request = ++revision;
        const panel = state.panel;
        if (!keys.length) { panel.hidden = true; return; }
        panel.hidden = false;
        if (!isReady()) { panel.textContent = 'Русские формы · загрузка словаря…'; return; }
        const results = await Promise.all(keys.map(key => compileKey(key, s, caseSensitive)));
        if (state.request !== request || !container.isConnected) return;

        // Settings or key edits can arrive while another manual-form draft is open.
        const drafts = new Map([...panel.querySelectorAll('details[data-key]')].map(row => [row.dataset.key, {
            open: row.open,
            value: row.querySelector('textarea')?.value,
            baseline: row.querySelector('textarea')?.dataset.saved,
        }]));
        const header = element('div', 'rwi-entry-heading');
        header.append(element('span', '', 'Русские формы'), element('span', 'rwi-entry-mode', active ? 'при поиске' : !s.enabled ? 'выключены' : 'книга не выбрана'));
        const content = document.createDocumentFragment(); content.append(header);
        for (const result of results) {
            const key = result.source;
            const manual = s.aliases[canonical(key)] || [];
            const excluded = s.excludedKeys.some(item => canonical(item) === canonical(key));
            const unknown = result.words.filter(word => !word.choices.length);
            const ambiguous = result.words.filter(word => word.choices.length > 1 && !word.selected);
            const recognized = result.words.some(word => word.selected && word.forms.length > 1);
            const row = element('details', 'rwi-key-forms'); row.dataset.key = key;
            row.open = drafts.get(key)?.open || false;
            const summary = element('summary', 'rwi-key-summary');
            summary.append(element('strong', 'rwi-key-source', key));
            const badges = element('span', 'rwi-key-badges');
            if (excluded) badges.append(element('span', 'rwi-badge', 'исключён'));
            else {
                if (recognized) badges.append(element('span', 'rwi-badge rwi-dictionary', 'словарь'));
                if (manual.length && result.words.length) badges.append(element('span', 'rwi-badge rwi-manual', `вручную · ${manual.length}`));
                if (ambiguous.length) badges.append(element('span', 'rwi-badge rwi-attention', 'выбрать значение'));
                if (unknown.length) badges.append(element('span', 'rwi-badge rwi-attention', 'нет в словаре'));
                if (!result.changed && !ambiguous.length && !unknown.length) badges.append(element('span', 'rwi-badge', 'исходный ключ'));
            }
            summary.append(badges);
            const examples = [...new Set([...result.words.flatMap(word => word.forms.filter(form => canonical(form) !== canonical(word.word))), ...(result.words.length ? manual : [])])];
            if (examples.length) summary.append(element('span', 'rwi-key-preview', `${examples.slice(0, 3).join(', ')}${examples.length > 3 ? ` … +${examples.length - 3}` : ''}`));
            row.append(summary);
            const body = element('div', 'rwi-key-body');
            if (!result.words.length) {
                body.append(element('p', 'rwi-hint', excluded ? 'Этот ключ исключён из обработки в настройках Russian WI Forms.' : 'Регулярное выражение, макрос или нерусский ключ: ST использует его без изменений.'));
            } else {
                for (const word of result.words) {
                    const wordBlock = element('div', 'rwi-editor-word');
                    wordBlock.append(element('strong', '', word.word));
                    if (word.choices.length > 1 || s.senses[canonical(word.word)]) {
                        const label = element('label', 'rwi-editor-label', 'Значение слова');
                        const select = element('select', 'text_pole');
                        select.append(new Option('Только исходное слово — значение не выбрано', ''));
                        for (const choice of word.choices) select.append(new Option(`${choice.lemma} · ${posNames[choice.pos] || choice.pos} · ${choice.forms.length} форм`, choice.id));
                        select.value = s.senses[canonical(word.word)] || '';
                        select.addEventListener('change', () => {
                            const current = getSettings();
                            if (select.value) current.senses[canonical(word.word)] = select.value;
                            else delete current.senses[canonical(word.word)];
                            saveSettings(); refresh();
                        });
                        label.append(select); wordBlock.append(label);
                    }
                    wordBlock.append(element('p', 'rwi-forms', word.choices.length ? word.forms.join(', ') : 'Словарь не распознал слово или имя. Добавьте известные вам формы ниже.'));
                    body.append(wordBlock);
                }
                const label = element('label', 'rwi-editor-label', 'Ручные формы этого ключа');
                const input = element('textarea', 'text_pole'); input.rows = 2;
                input.placeholder = 'Форма, другая форма';
                const saved = manual.join(', '), draft = drafts.get(key);
                input.value = draft && draft.value !== draft.baseline ? draft.value : saved;
                input.dataset.saved = saved;
                label.append(input); body.append(label);
                const actions = element('div', 'rwi-editor-actions');
                const button = element('button', 'menu_button', 'Сохранить формы'); button.type = 'button';
                const notice = element('span', 'rwi-hint', state.saved === key ? 'Сохранено' : ''); notice.setAttribute('role', 'status');
                input.addEventListener('input', () => { state.saved = null; notice.textContent = ''; });
                button.addEventListener('click', () => {
                    const forms = [...new Set(input.value.split(/[,\n]/).map(form => form.trim()).filter(Boolean))];
                    const current = getSettings();
                    if (forms.length) current.aliases[canonical(key)] = forms;
                    else delete current.aliases[canonical(key)];
                    input.value = forms.join(', '); input.dataset.saved = input.value;
                    state.saved = key;
                    saveSettings(); notice.textContent = 'Сохранено'; refresh();
                });
                actions.append(button, notice); body.append(actions);
                body.append(element('p', 'rwi-hint', 'Формы и значение слова общие для такого ключа во всех выбранных книгах. Исходные ключи книги остаются прежними.'));
            }
            row.append(body); content.append(row);
        }
        panel.replaceChildren(content);
        panel.classList.toggle('rwi-inactive', !active);
    }

    $(document).on('input.rwiEditor change.rwiEditor', `#world_popup_entries_list ${keySelector.split(', ').join(', #world_popup_entries_list ')}, #world_editor_select, #world_popup_entries_list select[name="caseSensitive"]`, refresh);
    const observer = new MutationObserver(records => {
        if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1 && !node.closest('.rwi-entry-forms') && (node.matches('.world_entry, .keyprimary, .keysecondary') || node.querySelector('.keyprimary, .keysecondary'))))) refresh();
    });
    observer.observe(document.getElementById('world_popup_entries_list') || document.body, { childList: true, subtree: true });
    refresh();
    return refresh;
}
