# Third-party components

## Az.js

Source: https://github.com/denull/Az.js

Pinned revision: `fa73ae7aeb193f830ae0755ffbb055ec1e37d89c`

Az.js is Copyright (c) 2016 deNULL, MIT licensed. Its original notice is included in [vendor/az/LICENSE](vendor/az/LICENSE).

Modification: `vendor/az/az.min.js` has an ES module wrapper around the upstream distribution. The morphology implementation is unchanged. No global `Az` object is installed.

## Russian dictionary data

The bundled Az.js dictionary is derived from [OpenCorpora](https://opencorpora.org/), which distributes its data under [Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/). These data retain that license; the addon's MIT license does not replace it. The compiled dictionary is distributed as supplied by Az.js, without data modifications.

Source and compilation metadata are retained in [vendor/az/dicts/meta.json](vendor/az/dicts/meta.json). This snapshot was compiled in 2016; it is not the latest OpenCorpora dictionary. OpenCorpora's data terms are described in its [FAQ](https://opencorpora.org/?page=faq).
