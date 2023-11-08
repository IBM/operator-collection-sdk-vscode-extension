/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { VSCodeCommands, VSCodeDiagnosticMessages } from "../../utilities/commandConstants";
import * as util from "../../utilities/util";
import * as workspace from "../../utilities/workspace";

export class ScaffoldCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): Promise<vscode.CodeAction[] | undefined> {
    const actions: vscode.CodeAction[] = [];

    // provide file scaffold options for operator-config.yaml/yml only
    if (document && /^operator-config.ya?ml$/gm.test(path.basename(document.uri.fsPath))) {
      for (const diagnostic of context.diagnostics) {
        // if the error is ~"playbook is invalid" error, create codeAction
        if (diagnostic.severity === vscode.DiagnosticSeverity.Error && (diagnostic.message.includes(VSCodeDiagnosticMessages.invalidPlaybookError) || diagnostic.message.includes(VSCodeDiagnosticMessages.invalidFinalizerError))) {
          // split on "-" to remove the diagnostic message, rejoin on "-" if the file name had "-"
          const filename = diagnostic.message.split("-").slice(1).join("-").trim();
          const directory = path.dirname(document.uri.fsPath);

          // get candidates, rank, and order based on the similarity of strings
          const playbooks = await this.gatherDirectoryPlaybooks(directory);
          const similarPlaybooks = playbooks
            .map((playbook, index) => {
              return {
                index: index,
                playbook: playbook,
                score: util.calcuateStringSimilarty(filename, playbook),
              };
            })
            .sort((a, b) => b.score - a.score) // sort candidates based on score decending
            .filter(item => item.score >= 0.5); // discard candidates with poor rankings

          if (similarPlaybooks.length) {
            let yamlKey: string = "";
            if (diagnostic.message.includes(VSCodeDiagnosticMessages.invalidFinalizerError)) {
              yamlKey = "finalizer: ";
            } else {
              yamlKey = "playbook: ";
            }

            // create actions for the top three playbooks in rank order
            const replaceActions = similarPlaybooks.slice(0, 3).map(item => {
              return this.inlineReplaceWithAction(yamlKey, item.playbook, document, range);
            });

            //

            actions.push.apply(actions, replaceActions); // extend actions array
          }

          actions.push(this.createBoilerplateFileAction(filename, directory));
        }
      }
    }

    return actions;
  }

  private async gatherDirectoryPlaybooks(directory: string): Promise<string[]> {
    const [files, _] = workspace.getDirectoryContent(directory, true, [".yaml", ".yml"]);

    const filteredFiles = [];
    for (let i = 0; i < files.length; i++) {
      try {
        // If the file contains the key "hosts", it is a playbook
        const doc = await vscode.workspace.openTextDocument(files[i]);
        if (doc.getText().includes("hosts:")) {
          filteredFiles.push(files[i]);
        }
      } catch (e) {
        console.log(`Can't open file ${files[i]}: ${e}`);
      }
    }

    return workspace.pruneDirectoryStem(directory, filteredFiles);
  }

  private createBoilerplateFileAction(filename: string, directory: string, isPreferred: boolean = false): vscode.CodeAction {
    const actionTitle = `Create boilerplate file for "${filename}"?`;
    const action = new vscode.CodeAction(actionTitle, vscode.CodeActionKind.QuickFix);
    action.command = {
      command: VSCodeCommands.createFile,
      title: actionTitle,
      arguments: [filename, directory],
    };
    action.isPreferred = isPreferred;
    return action;
  }

  /**
   * Returns a vscode.CodeAction
   * @param stem - A String.
   * @param paths - A String Array containing pathways.
   * @returns A String Array containing pruned pathways.
   */
  private inlineReplaceWithAction(yamlKey: string, suggestion: string, document: vscode.TextDocument, range: vscode.Range, isPreferred: boolean = false): vscode.CodeAction {
    const actionTitle = `Did you mean "${suggestion}" instead?`;
    const action = new vscode.CodeAction(actionTitle, vscode.CodeActionKind.QuickFix);
    action.command = {
      command: VSCodeCommands.inlineReplaceWith,
      title: actionTitle,
      arguments: [yamlKey + suggestion, document, range],
    };
    action.isPreferred = isPreferred;
    return action;
  }
}
