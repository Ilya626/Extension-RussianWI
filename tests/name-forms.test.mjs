import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire('C:/Users/user/AppData/Local/Temp/summaryception-ui-20261020/ui-tools/package.json');
const { chromium } = require('playwright-core');
const root = process.env.RWI_SOURCE_DIR ? pathToFileURL(process.env.RWI_SOURCE_DIR.replace(/\\/g, '/') + '/') : new URL('../', import.meta.url);
const output = process.env.RWI_OUTPUT_DIR ? pathToFileURL(process.env.RWI_OUTPUT_DIR.replace(/\\/g, '/') + '/') : new URL('../review/name-declension-20261101/', import.meta.url);
const stURL = process.env.RWI_ST_URL || 'http://127.0.0.1:8013';
let browser, page, savedSettings, savedEnabled, bootstrapEnabled;
const result = { surface: `native ${stURL} editor and WI scanner`, pageErrors: [], generationCalls: 0, backendRequests: [], checks: [] };
const word = () => page.locator('[data-rwi-name="элдарион"]').first();

async function showEntry() {
    await page.evaluate(async () => {
        const nativeWI = await import('/scripts/world-info.js');
        const entry = { ...structuredClone(nativeWI.newWorldInfoEntryTemplate), uid: 9191, world: 'Name forms example',
            key: ['Элдарион'], keysecondary: [], comment: 'Имя — склонение по роду', content: 'Name profile marker.',
            constant: false, selective: false, disable: false, excludeRecursion: true, preventRecursion: true };
        $('#WIDrawerIcon').trigger('click'); $('#world_popup_entries_list').show();
        const list = document.querySelector('#world_popup_entries_list'); list.replaceChildren();
        const node = await nativeWI.getWorldEntry(entry.world, { entries: { 9191: entry } }, entry);
        $(list).append(node); node.find('.inline-drawer-icon').first().trigger('click');
        globalThis.nameReview = { entry, original: JSON.stringify(entry), nativeWI };
    });
    await page.waitForSelector('[data-rwi-name="элдарион"]', { state: 'attached' });
    await page.locator('details.rwi-key-forms').first().evaluate(node => { node.open = true; });
    await page.waitForSelector('[data-rwi-name="элдарион"]');
}

before(async () => {
    await fs.mkdir(output, { recursive: true });
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
    page.on('pageerror', error => result.pageErrors.push(error.message));
    await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['127.0.0.1', 'localhost', new URL(stURL).hostname].includes(url.hostname)) return route.abort();
        if (url.pathname === '/api/extensions/update') return route.fulfill({ json: { isUpToDate: true } });
        if (url.pathname === '/api/settings/get') {
            const response = await route.fetch(), body = await response.json();
            const serialized = typeof body.settings === 'string';
            const preferences = serialized ? JSON.parse(body.settings) : body.settings || body;
            bootstrapEnabled = preferences.extension_settings?.worldMemory?.enabled;
            if (preferences.extension_settings?.worldMemory) preferences.extension_settings.worldMemory.enabled = false;
            if (body.settings !== undefined) body.settings = serialized ? JSON.stringify(preferences) : preferences;
            return route.fulfill({ response, json: body });
        }
        const prefix = '/scripts/extensions/third-party/Extension-RussianWI/';
        if (url.pathname.startsWith(prefix)) {
            const file = url.pathname.slice(prefix.length); if (file.includes('..')) return route.abort();
            return route.fulfill({ status: 200, body: await fs.readFile(new URL(file, root)),
                contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream' });
        }
        if (url.pathname.startsWith('/api/') && /\/backends\/|\/embedding/.test(url.pathname)) {
            result.backendRequests.push(url.pathname);
            if (/\/generate$|\/embedding/.test(url.pathname)) result.generationCalls++;
            return route.abort();
        }
        if (request.method() !== 'GET' && /\/edit$|\/delete$|\/generate$|\/import$|\/rename$|\/create$|\/upload$/.test(url.pathname))
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return route.continue();
    });
    await page.goto(stURL);
    await page.waitForFunction(() => globalThis.RussianWIForms?.getStatus().ready, null, { timeout: 90000 });
    await page.waitForFunction(() => !document.querySelector('.splash-screen'), null, { timeout: 90000 });
    result.version = await page.evaluate(() => RussianWIForms.getStatus().version);
    result.source = root.href;
    const initial = await page.evaluate(() => {
        const c = SillyTavern.getContext();
        const initial = { settings: structuredClone(c.extensionSettings.russianWIForms), enabled: c.extensionSettings.worldMemory?.enabled };
        if (c.extensionSettings.worldMemory) c.extensionSettings.worldMemory.enabled = false;
        Object.assign(c.extensionSettings.russianWIForms, { enabled: true, allBooks: true, guessNames: true,
            names: {}, aliases: {}, senses: {}, excludedKeys: [] });
        return initial;
    });
    savedSettings = initial.settings; savedEnabled = bootstrapEnabled ?? initial.enabled;
    await showEntry();
});

after(async () => {
    if (page && savedSettings) {
        const response = page.waitForResponse(response => response.url().endsWith('/api/settings/save')).catch(() => null);
        await page.evaluate(({ settings, enabled }) => {
            const c = SillyTavern.getContext(); c.extensionSettings.russianWIForms = settings;
            if (c.extensionSettings.worldMemory) c.extensionSettings.worldMemory.enabled = enabled;
            c.saveSettingsDebounced();
        }, { settings: savedSettings, enabled: savedEnabled });
        await response;
    }
    await fs.writeFile(new URL('result.private.json', output), JSON.stringify(result, null, 2));
    await browser?.close();
});

test('unknown Eldarion gets automatic cases and activates native WI without manual forms', async () => {
    const value = await page.evaluate(async () => {
        const morphology = await import('/scripts/extensions/third-party/Extension-RussianWI/morphology.js');
        const c = SillyTavern.getContext(), compiled = await morphology.compileKey('Элдарион', c.extensionSettings.russianWIForms);
        const { nativeWI, entry } = nameReview; let activated = [];
        const inject = payload => payload.globalLore.push(structuredClone(entry));
        const observe = entries => { activated = entries.map(item => item.uid); };
        c.eventSource.makeFirst(c.eventTypes.WORLDINFO_ENTRIES_LOADED, inject);
        c.eventSource.on(c.eventTypes.WORLD_INFO_ACTIVATED, observe);
        try { await nativeWI.getWorldInfoPrompt(['Письмо Элдариону.'], 800000, false); }
        finally { c.eventSource.removeListener(c.eventTypes.WORLDINFO_ENTRIES_LOADED, inject); c.eventSource.removeListener(c.eventTypes.WORLD_INFO_ACTIVATED, observe); }
        return { cases: compiled.words[0].name.cases, mode: compiled.words[0].name.mode, activated, noManual: Object.keys(c.extensionSettings.russianWIForms.aliases).length === 0 };
    });
    assert.deepEqual(value.cases, ['Элдарион', 'Элдариона', 'Элдариону', 'Элдариона', 'Элдарионом', 'Элдарионе']);
    assert.equal(value.mode, 'auto'); assert.ok(value.activated.includes(9191)); assert.equal(value.noManual, true);
    await page.locator('#world_popup_entries_list').screenshot({ path: new URL('desktop.png', output).pathname.slice(1) });
    result.checks.push({ automaticNativeActivation: true, ...value });
});

test('gender and indeclinable choices regenerate the proposed cases in the native editor', async () => {
    await word().locator('select').selectOption('female');
    await page.waitForFunction(() => SillyTavern.getContext().extensionSettings.russianWIForms.names['элдарион']?.gender === 'female');
    await page.waitForTimeout(250);
    assert.deepEqual(await word().locator('.rwi-name-cases input').evaluateAll(inputs => inputs.map(input => input.value)), Array(6).fill('Элдарион'));
    await word().locator('select').selectOption('male'); await page.waitForTimeout(250);
    assert.equal(await word().locator('.rwi-name-cases input').nth(2).inputValue(), 'Элдариону');
    await word().locator('select').selectOption('fixed'); await page.waitForTimeout(250);
    assert.deepEqual(await word().locator('.rwi-name-cases input').evaluateAll(inputs => inputs.map(input => input.value)), Array(6).fill('Элдарион'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: new URL('mobile.png', output).pathname.slice(1) });
    result.checks.push({ genderSelection: true, indeclinable: true });
});

test('manual case corrections survive reload, replace the proposal and preserve native keys and hashes', async () => {
    await word().locator('select').selectOption('male'); await page.waitForTimeout(250);
    await word().locator('.rwi-name-cases input').nth(2).fill('Элдарионику');
    const saved = page.waitForResponse(response => response.url().endsWith('/api/settings/save')
        && response.request().postData()?.includes('Элдарионику'));
    await word().getByRole('button', { name: 'Сохранить поправки', exact: true }).click(); await saved;
    await page.reload(); await page.waitForFunction(() => globalThis.RussianWIForms?.getStatus().ready, null, { timeout: 90000 });
    const value = await page.evaluate(async () => {
        const c = SillyTavern.getContext(), morphology = await import('/scripts/extensions/third-party/Extension-RussianWI/morphology.js');
        const s = c.extensionSettings.russianWIForms, compiled = await morphology.compileKey('Элдарион', s);
        const { parseRegexFromString } = await import('/scripts/world-info.js'), regex = parseRegexFromString(compiled.key);
        const payload = { globalLore: [{ world: 'example', key: ['Элдарион'], keysecondary: [] }] }, original = JSON.stringify(payload.globalLore[0]);
        await morphology.expandEntries(payload, s);
        return { saved: s.names['элдарион'].forms[2], correctedHit: regex.test('Письмо Элдарионику.'),
            replacedProposal: !regex.test('Письмо Элдариону.'), originalHash: original === JSON.stringify(payload.globalLore[0]),
            originalKeys: payload.globalLore[0].key.toJSON() };
    });
    assert.equal(value.saved, 'Элдарионику');assert.equal(value.correctedHit, true);assert.equal(value.replacedProposal, true);
    assert.equal(value.originalHash, true);assert.deepEqual(value.originalKeys, ['Элдарион']);
    result.checks.push({ persistentManualCorrections: true, ...value });
    assert.deepEqual(result.pageErrors, []); assert.equal(result.generationCalls, 0);
});
