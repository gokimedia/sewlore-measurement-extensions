# Sewlore Measurement Extensions

Two independent, locally running tools for recording sewing measurements. The [VS Code editor extension](https://marketplace.visualstudio.com/items?itemName=gokimedia.sewlore-measurement-record-checker) is published in Visual Studio Marketplace. The Firefox 0.1.0 package has been submitted to AMO; **signing, publication and review remain pending**.

| Tool | Purpose | Source | Current checks |
| --- | --- | --- | --- |
| Firefox: Sewlore Measurement Check | Convert mm/cm/in, compare both axes of a print square, and export a requested CSV record | [Firefox source and instructions](firefox/README.md) | Numeric, equivalence, manifest and DOM-handler tests; submitted to AMO, with signing/publication/review pending; native Firefox installation/download checks not yet completed |
| VS Code: Sewlore Measurement Record Checker | Diagnose invalid fabric-care CSV fields in the active editor and summarize signed dimensional changes | [Editor source and instructions](editor/README.md) | Parser tests and an isolated desktop VS Code 1.139.0 Extension Host check; [published in Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=gokimedia.sewlore-measurement-record-checker); Open VSX submission pending |

## Choose the tool

Use the Firefox toolbar tool when you want a single calculation or a print-square record without reading website content. Entries clear when the popup closes. Downloads happen only when you request an export.

Use the editor extension when you already keep a CSV of before/after sample dimensions. It checks the ten-column schema, matching before/after units, positive finite readings and the explicit rectangle assumption. It shows errors at the relevant editor position. A valid numeric record does not prove that its measurements are accurate or that a physical test occurred.

Neither runtime contains a network client, telemetry, remote executable code or a third-party runtime package dependency. The Firefox tool has no page-access permissions or persistent browser storage. The editor tool reads only the active editor buffer, does not traverse the workspace and does not automatically save or rewrite files. Optional documentation links do not receive measurement values.

## Record the method as well as the number

The [Sewlore measurement methods guide](https://sewlore.com/pages/fabric-measurement-methods-guide) explains units, procedure and assumptions. The [Sewlore Measurement Reference](https://sewlore.gitbook.io/sewlore-docs) covers signed changes, numeric domains and selecting a calculation tool. [Sewlore](https://sewlore.com/) publishes sewing measurement resources.

These are arithmetic aids. A working print threshold is not a material or printer standard. Printed-axis errors and the difference between those errors answer different questions. Rectangular area change uses the product of axis ratios, rather than adding their percentages. The included sample records are explicitly invented exercises, not laboratory evidence.

## Development and packaging

The two projects have separate manifests, licenses and test commands. There is no top-level install script.

Firefox development needs Node 20 or newer and Python 3.10 or newer:

```sh
cd firefox
npm ci --ignore-scripts
npm test
python build_package.py
npm exec -- web-ext lint --source-dir extension --output json
```

The pinned developer toolchain is excluded from the Firefox runtime ZIP. Its current lint-tool dependency limitations are disclosed in the Firefox README. This is not a claim that every developer dependency audit is clear.

The editor source uses plain CommonJS JavaScript with no runtime dependencies:

```sh
cd editor
npm test
npm exec --ignore-scripts --yes --package=@vscode/vsce@4.0.0 -- vsce package --no-dependencies --allow-missing-repository
```

Packaging creates a local VSIX; that command does not publish it. The editor extension is published under Visual Studio Marketplace publisher ID `gokimedia` (Sewlore). Open VSX publication is pending. The declared minimum editor version has not been separately executed; the actual integration check used VS Code 1.139.0.

The Firefox AMO submission awaits signing, publication and review; native Firefox installation/download checks remain pending. Editor marketplaces require their own publisher identity and publication process. No credential, private receipt, installed dependency, binary package or editor profile is included in this source repository.

## Support and licensing

For a reproducible issue, specify the project and version, the input, expected output and actual output. Use an invented minimal CSV or measurement example and remove personal or confidential notes before sharing it. A public support tracker must be confirmed before release; no unverified tracker is represented as available.

The source is MIT licensed. Each project preserves its license and Sewlore copyright: [Firefox license](firefox/extension/LICENSE), [editor license](editor/LICENSE). The Firefox print calculation and CSV text-neutralisation policy are adapted from Sewlore's MIT calculation tools; its preserved comparison fixture tests the original behavior. The editor schema and numeric conventions are adapted from the MIT Fabric Care Validator. Names and branding do not transfer with the software license.
