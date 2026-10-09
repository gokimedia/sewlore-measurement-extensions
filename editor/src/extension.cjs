'use strict';

// Copyright (c) 2026 Sewlore. MIT License.
const vscode = require('vscode');
const { validateCsv, TEMPLATE } = require('./validator.cjs');
const DIAGNOSTIC_LIMIT = 200;
const OUTPUT_RECORD_LIMIT = 200;
const DEBOUNCE_MS = 250;

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('sewlore-measurements');
  const output = vscode.window.createOutputChannel('Sewlore Measurements');
  let timer;
  let disposed = false;
  const manuallyEnabled = new Set();

  function isCsv(document) {
    return document.languageId === 'csv' || document.uri.path.toLowerCase().endsWith('.csv');
  }
  function hasMeasurementHeader(text) {
    const firstLine = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/, 1)[0];
    return firstLine === TEMPLATE.trimEnd();
  }
  function diagnose(document, text) {
    const result = validateCsv(text);
    const diagnostics = result.diagnostics.slice(0, DIAGNOSTIC_LIMIT).map(problem => {
      const start = document.positionAt(problem.start);
      let end = document.positionAt(problem.end);
      if (start.isEqual(end)) {
        end = document.lineAt(start.line).range.end;
        if (start.isEqual(end)) end = start;
      }
      const diagnostic = new vscode.Diagnostic(new vscode.Range(start, end), `${problem.field}: ${problem.message}`, vscode.DiagnosticSeverity.Error);
      diagnostic.source = 'Sewlore';
      diagnostic.code = problem.code;
      return diagnostic;
    });
    if (result.diagnostics.length > DIAGNOSTIC_LIMIT) {
      const countMessage = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `${result.diagnostics.length} issues found; only the first ${DIAGNOSTIC_LIMIT} field issues are displayed. Run validation for the summary.`, vscode.DiagnosticSeverity.Information);
      countMessage.source = 'Sewlore';
      diagnostics.push(countMessage);
    }
    collection.clear();
    collection.set(document.uri, diagnostics);
    return result;
  }
  function refresh() {
    if (disposed) return;
    const editor = vscode.window.activeTextEditor;
    if (!editor || !isCsv(editor.document)) {
      collection.clear();
      return;
    }
    const document = editor.document;
    const text = document.getText();
    if (hasMeasurementHeader(text) || manuallyEnabled.has(document.uri.toString())) diagnose(document, text);
    else collection.clear();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(refresh, DEBOUNCE_MS);
  }
  function percentage(value) {
    return value === null ? 'not requested' : `${Number(value.toPrecision(10))}%`;
  }

  context.subscriptions.push(collection, output,
    vscode.commands.registerCommand('sewlore.measurements.validate', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !isCsv(editor.document)) {
        return vscode.window.showInformationMessage('Open a CSV editor first, or use Sewlore: Open Measurement CSV Template.');
      }
      clearTimeout(timer);
      const document = editor.document;
      manuallyEnabled.add(document.uri.toString());
      const result = diagnose(document, document.getText());
      output.clear();
      output.appendLine('Sewlore Measurement Record Checker');
      output.appendLine('Checked only the active editor buffer. Nothing was sent or saved.');
      output.appendLine(`Valid records: ${result.records.length}; rejected records: ${result.rejectedRecords}; issues: ${result.diagnostics.length}.`);
      output.appendLine('Positive change means shrinkage; negative change means expansion.');
      for (const record of result.records.slice(0, OUTPUT_RECORD_LIMIT)) {
        output.appendLine(`Record ${record.recordNumber} ${JSON.stringify(record.sample_id)}: length ${percentage(record.lengthChangePercent)}; width ${percentage(record.widthChangePercent)}; rectangular area ${percentage(record.rectangularAreaChangePercent)}.`);
      }
      if (result.records.length > OUTPUT_RECORD_LIMIT) output.appendLine(`Only the first ${OUTPUT_RECORD_LIMIT} valid records are shown.`);
      for (const problem of result.diagnostics.slice(0, DIAGNOSTIC_LIMIT)) {
        const position = document.positionAt(problem.start);
        output.appendLine(`Line ${position.line + 1}, column ${position.character + 1}: ${problem.field}: ${problem.message}`);
      }
      if (result.diagnostics.length > DIAGNOSTIC_LIMIT) output.appendLine(`Only the first ${DIAGNOSTIC_LIMIT} issues are listed.`);
      output.show(true);
      return { validRecords: result.records.length, rejectedRecords: result.rejectedRecords, issueCount: result.diagnostics.length };
    }),
    vscode.commands.registerCommand('sewlore.measurements.template', async () => {
      const document = await vscode.workspace.openTextDocument({ content: TEMPLATE, language: 'csv' });
      await vscode.window.showTextDocument(document);
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      collection.clear();
      schedule();
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (vscode.window.activeTextEditor?.document === event.document) schedule();
    }),
    vscode.workspace.onDidCloseTextDocument(document => {
      manuallyEnabled.delete(document.uri.toString());
      collection.delete(document.uri);
    }),
    { dispose() { disposed = true; clearTimeout(timer); manuallyEnabled.clear(); } },
  );
  refresh();
}

function deactivate() {}
module.exports = { activate, deactivate };
