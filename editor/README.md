# Sewlore Measurement Record Checker

Check a fabric-care measurement CSV while you edit it. Invalid values appear in VS Code's Problems view at the corresponding field. Run **Sewlore: Validate Current Measurement CSV** to see the valid-record count, rejected-record count and calculated changes in an Output panel.

## Quick start

1. Open a CSV in VS Code, or run **Sewlore: Open Measurement CSV Template**.
2. Use the exact header below. Enter one sample per record.
3. Run **Sewlore: Validate Current Measurement CSV** from the Command Palette.
4. Correct errors and run validation again. Diagnostics also update after edits while this CSV remains the active editor.

```csv
sample_id,before_unit,after_unit,before_length,before_width,after_length,after_width,care_method,rectangle_assumption,notes
demo,cm,cm,20,10,19,9.5,synthetic worked example,yes,Invented example only
```

The example above gives 5% length shrinkage, 5% width shrinkage and 9.75% rectangular area shrinkage. Examples included with this extension are invented arithmetic exercises, not physical testing evidence.

## CSV contract

- The ten-column header is case sensitive and must keep its supplied order. Do not add columns.
- `sample_id` and `care_method` must contain text. Record the actual procedure in `care_method`; this checker does not verify it.
- `before_unit` and `after_unit` accept `mm`, `cm` or `in`, ignoring surrounding spaces and letter case. Both units must match within a record. Different records may use different units. This checker does not silently convert mixed before/after units.
- All four dimensions must be positive finite decimal numbers. Dot decimals and scientific notation are supported. Unit suffixes, thousands separators, zero, negative numbers, `NaN` and `Infinity` are rejected.
- `rectangle_assumption` accepts `yes`, `no` or an empty cell. Choose `yes` only if both samples were actually rectangles. Area is not calculated otherwise.
- `notes` is optional. Use double quotes around cells containing a comma, newline or double quote; represent a literal double quote as `""` inside a quoted cell.
- LF, CRLF and CR line endings and an initial UTF-8 BOM are supported. A completely empty line after the header is ignored. A partly empty record is still validated.
- This strict parser requires a comma or line ending immediately after a closing quote. It rejects quotes inside an unquoted cell and incomplete quoted cells. A structural CSV error prevents calculations for the whole file.
- A CSV may contain at most one million UTF-16 characters and 20,000 data records, counting completely empty lines. Very large numeric ranges that overflow or underflow during comparison are rejected.

Automatic checks apply only to the active CSV with the exact unquoted header shown above, or a CSV explicitly checked with the command. Other CSV files are not automatically diagnosed. The command accepts a quoted equivalent header too.

The extension registers a CSV language mode for `.csv` files so it works in a fresh VS Code installation. It does not provide syntax highlighting or change the CSV format.

## Reading the result

Change is calculated as `(1 - after / before) × 100`. Positive values mean shrinkage; negative values mean expansion. Rectangular area change uses the product of the two axis ratios, not the sum of the axis percentages.

The Output panel shows at most 200 valid records and 200 issues; the summary counts include every validated record and issue within the stated limits. The Problems view similarly displays the first 200 field issues plus an overflow notice if necessary. Record numbers count CSV records; line numbers refer to physical editor lines, including newlines within quoted cells.

This checks the structure and numeric consistency of a record. It does not confirm measurement accuracy, fabric quality, material suitability or whether a real test occurred. Calculations use JavaScript floating-point numbers; they do not add precision to the original readings.

## Privacy and file access

Validation runs locally in the extension host on the active editor buffer. The extension has no network calls, telemetry, runtime dependencies, account access, filesystem traversal or automatic writes. It does not execute spreadsheet formulas. It creates an unsaved template only when you request that command. Switching away clears this extension's diagnostics; switching back recomputes them for an eligible active CSV.

## Methods and documentation

Read the [Sewlore measurement methods guide](https://sewlore.com/pages/fabric-measurement-methods-guide) for recording units, assumptions and procedure. The [Sewlore Measurement Reference](https://sewlore.gitbook.io/sewlore-docs) explains signed changes, numeric domains and choosing a tool. [Sewlore](https://sewlore.com/) publishes sewing measurement resources.

## Source and support

The [public editor source](https://github.com/gokimedia/sewlore-measurement-extensions/tree/main/editor) is available in Sewlore's measurement extensions repository. Report reproducible problems through the [public issue tracker](https://github.com/gokimedia/sewlore-measurement-extensions/issues), using an invented minimal CSV and removing personal or confidential notes.

Source publication is complete; marketplace submission remains pending. The package still uses the unconfirmed publisher candidate `gokimedia`; this is not a claim of store ownership or approval.

## Development

This extension contains plain CommonJS JavaScript and has no runtime package dependencies. Run `npm test` for parser and validation tests. Packaging uses the official `@vscode/vsce` tool. Marketplace publishing is a separate step that requires a confirmed publisher account.

Licensed under MIT. Schema and calculation conventions are adapted from Sewlore's MIT-licensed Fabric Care Validator; the editor adapter and strict offset-aware CSV parser are new.
