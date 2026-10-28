# Russian WI Forms

A small SillyTavern extension that lets Russian World Info keywords match their inflected forms. Version 0.1.0.

Write `меч` in a normal lorebook key. Messages containing `меча`, `мечом` or `мечей` can activate that entry. The extension expands dictionary forms locally and passes one generated regex per original keyword to ST's normal scanner.

There are no model requests, external APIs, Python services or extra prompt tokens. The bundled dictionary loads from the ST host, about 11 MB before HTTP compression/browser caching. The book content, saved keys and chat messages are not rewritten.

## Try it

1. Put the `Extension-RussianWI` folder in `SillyTavern/public/scripts/extensions/third-party/`. `manifest.json` must be directly inside that folder. Reload ST.
2. Open **Extensions → Russian WI Forms**. **Enable Russian word forms** and **Use all connected lorebooks** are enabled by default.
3. Add a normal keyword such as `меч` to a connected WI entry. A message containing `мечом` can now trigger it.
4. In **Preview a trigger**, enter `меч` and the example `Она ударила мечом.` Click **Preview / Check** to inspect the forms and result.

To limit processing, uncheck **Use all connected lorebooks** and select the books to process. This selects where morphology applies; the normal ST character/chat/global book bindings still control which books are connected.

## Ambiguous words and invented names

`стали` can be a noun form of `сталь` or a verb form of `стать`. Such a word stays literal until you choose its dictionary meaning in Preview. The choice is saved for that spelling and applies in future scans. Some adjectives can also be nouns: `чёрный` is one example. For `чёрный рыцарь`, choose the adjective interpretation of `чёрный` to match `чёрному рыцарю`.

Unknown names are not guessed. Add their forms in **Exceptions and custom forms**:

```text
Элдарион = Элдариона, Элдариону, Элдарионом
```

Click **Save exceptions and forms**. To keep a whole keyword unchanged, put it in **Exact keys to leave unchanged**, one key per line. Existing regexes and keys containing ST macros are left unchanged automatically.

The dictionary parser does not correct typos or stretched letters. It expands grammatical forms, not synonyms or arbitrary words with the same prefix. `мечтать` does not match the generated forms of `меч`. Generated regexes have Unicode word boundaries; they do not rely on JavaScript's ASCII-oriented `\b`. Letter-case matching follows the native entry/global setting. The optional е/ё checkbox applies to generated forms.

Phrase words stay in their original order with whitespace between them. Each word is expanded separately, without building a Cartesian product of entire phrases. This is morphology, not a syntactic or semantic parser: it does not infer a word's meaning from the surrounding scene or validate agreement between all phrase words.

## Native ST behavior

Both primary and secondary keywords are expanded. **One original keyword remains one keyword**, so AND ALL filters and inclusion-group scoring do not start counting each inflection as another requirement or point. Native probabilities, recursion, book bindings, budgets and insertion positions still run in ST.

The extension listens to ST's `WORLDINFO_ENTRIES_LOADED` event and changes only scan-time entry copies. ST's JSON entry hash still sees the original keys; its subsequent structured clone receives the generated regexes. This preserves entry hashes used by sticky/cooldown effects. There is no monkey patch of the WI scanner and no rewriting of native ST files. If dictionary preparation fails, the unmodified keyword arrays remain available to native matching.

## Memory Books and other WI writers

The first integration target is [Memory Books](https://github.com/aikohanasaki/SillyTavern-MemoryBooks), the project listed in ST's extension catalog. Its lorebook writer uses native `saveWorldInfo` / `worldInfoCache` and WI update events. Newly created or modified Russian keys therefore reach morphology at the next native scan; no copy of generated regexes is written back into Memory Books' memory records or rollback fingerprints.

**Use all connected lorebooks** also covers newly created chat books. In selected-books mode, add each new book to the selection. Keys-only changes naturally produce a fresh compilation; no manual cache reset is needed.

Other writers using native WI data follow the same path. Custom injection pipelines that bypass native WI key scanning need their own integration check. Vector-only retrieval and constant entries do not become keyword-filtered simply by installing this addon.

Our Summaryception fork calls ST's native WI scanner, so the same morphology event also handles its selected-passage scans. Existing Summaryception settings still control whether WI is scanned and how much reference lore is included.

Verified locally with **SillyTavern 1.19.0**, **Memory Books 9.3.9** (`c2ef390`) and **Summaryception local.18**. A real Memory Books writer created a `меч` entry, which activated on `мечом`; its update to `рыцарь` activated on `рыцарю` and stopped activating on the old key. Saved keys and the `stmemorybooks` flag stayed intact. Native checks also verified primary/secondary keys, a `мечтать` negative control, unchanged entry hashes, active sticky/cooldown, manual aliases and the Summaryception WI path. Mobile Edge UI was inspected. No external model was called; these checks establish matching and integration, not AI-generated lore quality.

**MemoryBooks Auto is a separate integration target.** Some of its living-lore features use their own text matchers instead of native WI scanning. Those paths do not acquire Russian morphology automatically from this extension. Native WI activation still goes through the hook described above.

## License and dictionary

Addon code: MIT, see [LICENSE](LICENSE). Az.js: MIT. Bundled OpenCorpora-derived dictionary data: CC BY-SA 3.0. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for the pinned upstream revision, original notices and dictionary age.
