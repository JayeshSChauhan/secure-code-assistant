"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityFixer = void 0;
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const path = require("path");
const diagnosticCollection = vscode.languages.createDiagnosticCollection('security');
function activate(context) {
    console.log('Congratulations, your extension "secure-code-assistant" is now active!');
    let enrichPromptCommand = vscode.commands.registerCommand('secure-code-assistant.enrichPrompt', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;
            const originalPrompt = editor.document.getText(selection);
            const enrichedPrompt = originalPrompt +
                `\n\n---
                \nIMPORTANT: Please ensure the generated code follows security best practices. Specifically:
                1. Avoid hardcoded secrets; use environment variables.
                2. Implement proper authorization checks.
                3. Use parameterized queries to prevent SQL injection.
                4. Sanitize all user inputs.`;
            editor.edit(editBuilder => {
                editBuilder.replace(selection, enrichedPrompt);
            });
        }
    });
    context.subscriptions.push(enrichPromptCommand);
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(document => {
        if (document.languageId === 'python') {
            scanDocument(document);
        }
    }));
    if (vscode.window.activeTextEditor) {
        scanDocument(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider('python', new SecurityFixer(), {
        providedCodeActionKinds: SecurityFixer.providedCodeActionKinds
    }));
}
function scanDocument(document) {
    const diagnostics = [];
    const rulesPath = path.join(__dirname, '..', 'rules', 'python-security.yml');
    const filePath = document.fileName;
    const command = `semgrep --config "${rulesPath}" --json "${filePath}"`;
    (0, child_process_1.exec)(command, (error, stdout, stderr) => {
        if (stderr && !stdout) {
            if (stderr.includes("no rules found") || stderr.includes("no files matched")) {
                diagnosticCollection.set(document.uri, []);
                return;
            }
            console.error(`Semgrep error: ${stderr}`);
            return;
        }
        try {
            const output = JSON.parse(stdout);
            const findings = output.results || [];
            for (const finding of findings) {
                const range = new vscode.Range(finding.start.line - 1, finding.start.col - 1, finding.end.line - 1, finding.end.col - 1);
                const diagnostic = new vscode.Diagnostic(range, finding.extra.message, finding.extra.severity === 'ERROR' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
                // This is where the long code was coming from. Our fix below handles it.
                diagnostic.code = finding.check_id;
                diagnostics.push(diagnostic);
            }
            diagnosticCollection.set(document.uri, diagnostics);
        }
        catch (e) {
            console.error("Failed to parse Semgrep JSON output.", e);
            diagnosticCollection.clear();
        }
    });
}
class SecurityFixer {
    provideCodeActions(document, range, context, token) {
        const actions = [];
        for (const diagnostic of context.diagnostics) {
            // *** THE FIX IS HERE ***
            // We now check if the code ENDS WITH our rule ID, instead of an exact match.
            if (typeof diagnostic.code === 'string' && diagnostic.code.endsWith('hardcoded-secret')) {
                const fix = this.createHardcodedSecretFix(document, diagnostic.range);
                if (fix) {
                    fix.diagnostics = [diagnostic];
                    fix.isPreferred = true;
                    actions.push(fix);
                }
            }
        }
        return actions;
    }
    createHardcodedSecretFix(document, range) {
        const fix = new vscode.CodeAction('Replace with os.environ.get()', vscode.CodeActionKind.QuickFix);
        fix.edit = new vscode.WorkspaceEdit();
        const lineText = document.lineAt(range.start.line).text;
        const match = lineText.match(/^\s*([a-zA-Z_]+)\s*=/);
        if (!match)
            return undefined;
        const variableName = match[1];
        const replacementText = `os.environ.get("${variableName.toUpperCase()}")`;
        const equalSignIndex = lineText.indexOf('=');
        if (equalSignIndex === -1)
            return undefined;
        const replacementRange = new vscode.Range(range.start.line, equalSignIndex + 1, range.end.line, lineText.length);
        fix.edit.replace(document.uri, replacementRange, ` ${replacementText}`);
        if (!document.getText().includes('import os')) {
            fix.edit.insert(document.uri, new vscode.Position(0, 0), 'import os\n');
        }
        return fix;
    }
}
exports.SecurityFixer = SecurityFixer;
SecurityFixer.providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];
function deactivate() { }
//# sourceMappingURL=extension.js.map