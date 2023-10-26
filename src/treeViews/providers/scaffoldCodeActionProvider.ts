/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from "path";
import * as vscode from "vscode";
import {
  VSCodeCommands,
  VSCodeDiagnosticMessages,
} from "../../utilities/commandConstants";

export class ScaffoldCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  public provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] | undefined {
    const actions: vscode.CodeAction[] = [];

    // provide file scaffold options for specific yaml files
    if (
      (document &&
        path.basename(document.uri.fsPath) === "operator-config.yaml") ||
      path.basename(document.uri.fsPath) === "operator-config.yml"
    ) {
      for (const diagnostic of context.diagnostics) {
        // if the error is playbook is invalid
        if (
          diagnostic.severity === vscode.DiagnosticSeverity.Error &&
          (diagnostic.message.includes(
            VSCodeDiagnosticMessages.invalidPlaybookError,
          ) ||
            diagnostic.message.includes(
              VSCodeDiagnosticMessages.invalidFinalizerError,
            ))
        ) {
          const filename = diagnostic.message.trim().split("-")[1].trim();
          const directory = path.dirname(document.uri.fsPath);

          actions.push(this.createBoilerplateFileAction(filename, directory));
        }
      }
    }

    return actions;
  }

  private createBoilerplateFileAction(
    filename: string,
    directory: string,
  ): vscode.CodeAction {
    const actionTitle = `Create boilerplate file for "${filename}"?`;
    const action = new vscode.CodeAction(
      actionTitle,
      vscode.CodeActionKind.QuickFix,
    );
    action.command = {
      command: VSCodeCommands.createFile,
      tooltip: `Create a scaffold file for ${filename}?`,
      title: actionTitle,
      arguments: [filename, directory],
    };
    action.isPreferred = true;
    return action;
  }
}
