# Sewlore Measurement Check

A genuine offline Firefox toolbar tool for length conversion and recording the two axes of a printed test square. It does not read websites, insert links into pages or open a website on installation. The documentation link is optional and opens only when clicked.

## Features

- Convert one non-negative length into millimetres, centimetres and international inches (1 in = 25.4 mm).
- Compare manually entered width and height against one intended square side.
- Retain signed errors and distinguish the individual-axis flag from the difference-between-axes flag.
- Export either calculation as a local CSV record, including the entered label, units, full available numeric results and both flags.
- Explain the denominator, threshold and numeric limitations inside the popup.

All inputs begin empty except the editable threshold preference of 0.5. These are not physical test results. The threshold is not an industry, fabric or printer standard. The same numeric value is used in percent for individual axes and percentage points for the difference between axes; the interface states this explicitly.

Entries exist only in the open popup. Closing it clears them. The extension contains no analytics, advertising, login, browser storage, background scripts, page-access permissions or automatic network requests. CSV exports are initiated only by the user. Formula-like text labels receive a leading apostrophe and CSV escaping.

## Source and licensing

Software and the original geometric SVG icon are MIT licensed (see `extension/LICENSE`). `calculatePrintScale` and the CSV escaping policy are adapted from the MIT-licensed Sewlore `sewlore-sewing-tools/calculations.js` file. The original package is left untouched. An independent equivalence test compares the extension's print calculation with that source. New conversion code adds mm support and rejects total underflow/overflow.

There is no bundle, minification, remote code or dependency in the extension runtime. All shipped JavaScript is directly reviewable. Node test dependencies, when present, are developer-only and excluded from the upload ZIP.

## Public source, support and privacy

The [Firefox source directory](https://github.com/gokimedia/sewlore-measurement-extensions/tree/main/firefox) is public. Report software problems in the [project issue tracker](https://github.com/gokimedia/sewlore-measurement-extensions/issues). The [plain-language privacy statement](https://github.com/gokimedia/sewlore-measurement-extensions/blob/main/firefox/PRIVACY.md) is publicly readable. These addresses were verified against source commit `86ada8b940aeceb796ebea99d723daafd7ca957f`; store acceptance of the GitHub privacy-page format remains a publisher check.

The public repository documents a submission candidate. Its existence does not establish Firefox signing, marketplace approval or native host testing. The extension's homepage remains the Sewlore measurement methods guide.

## Reproduce checks and packaging

1. Run `npm ci` to install the pinned developer-only DOM test and lint tools (Node 20 or newer).
2. Run `npm test`.
3. Run `python build_package.py`. Python 3.10 or newer; standard library only.
4. Run `npm exec -- web-ext lint --source-dir extension --output json` for the pinned Mozilla package linter. This is a local validation command, not an authentication or publication command.

The upload ZIP places `manifest.json` at its root and contains only the runtime files. A separate source ZIP includes the documentation, tests, exact upstream comparison fixture, dependency lock and build instructions. Packaging is deterministic with fixed ZIP metadata; `build-manifest.json` records the SHA256 values and file list. Runtime has no dependencies. The developer toolchain uses an override for the patched `shell-quote` 1.12.0 release. The current official `web-ext` dependency tree still reports three high advisory entries inherited from its unused Android-runner `node-forge` path; that toolchain is excluded from both runtime ZIP and browser execution. No claim of a fully clean developer dependency audit is made.

## Actual Firefox review before publication

The package is a submission candidate, not a signed or approved add-on. Load `extension/manifest.json` with Firefox's standard temporary-extension workflow (`about:debugging` → This Firefox → Load Temporary Add-on), then verify the following before sending to AMO:

- Enter 1 in: results mm 25.4 and cm 2.54. Export and inspect the CSV.
- Enter target 100, X 99.6, Y 100.4, threshold 0.5 in common mm: signed errors −0.4% and +0.4%, gap 0.8 pp, both-axis flag Yes and gap-exceeds flag Yes.
- Enter target 100, X 98, Y 98: gap 0 pp, both-axis flag No and gap-exceeds flag No.
- Change any field after calculating: previous output disappears and export is disabled until recalculated.
- Enter a label `=1+1` and export: the CSV begins that label with an apostrophe. No formula should execute.
- Close and reopen the popup: inputs have cleared. Check keyboard navigation, scrolling, focus visibility, dark mode, and user-initiated CSV download in Firefox.
- Disable internet: both calculations continue to work. No runtime website visits are needed.

The automated DOM tests cover the form handlers, output text, stale-result prevention and actual CSV string generation. They do not establish Firefox installation, native download behavior, screenshot quality, signing or marketplace acceptance. Those remain browser/publisher checks.

## Mozilla documentation checked on 9 October 2026

- [Manifest browser-specific settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings): MV3 signing needs an explicit Gecko ID. This package uses the syntactic extension ID `measurement-check@sewlore.com`; it is not a login or a claimed email inbox.
- [Built-in data collection consent](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/): new extensions declare data transmission. The package declares `required: ["none"]` and targets Firefox desktop 142 or later. It does not declare Android availability.
- [Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/): genuine functionality, minimal permissions, no remote executable code, and readable sources.
- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/): marketplace validation and review remain required.

No account handle, AMO URL, review result, backlink, installation count or indexing result is claimed by this candidate package.
