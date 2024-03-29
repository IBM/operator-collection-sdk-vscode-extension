/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import * as util from "../../utilities/util";
import * as workspace from "../../utilities/workspace";
import { VSCodeCommands, VSCodeDiagnosticMessages } from "../../utilities/commandConstants";

export class ScaffoldCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  public async provideCodeActions(document: vscode.TextDocument, range: vscode.Range, context: vscode.CodeActionContext): Promise<vscode.CodeAction[] | undefined> {
    const actions: vscode.CodeAction[] = [];

    // provide codeActions for operator-config.yaml/yml files only
    if (document && /^operator-config.ya?ml$/.test(path.basename(document.uri.fsPath))) {
      const directory = path.dirname(document.uri.fsPath);
      for (const diagnostic of context.diagnostics) {
        if (diagnostic.severity === vscode.DiagnosticSeverity.Error && diagnostic.message === VSCodeDiagnosticMessages.missingGalaxyFile) {
          // if the error is "Missing galaxy file error"
          actions.push(this.createGalaxyBoilerplateFile(directory));
        } else if (diagnostic.severity === vscode.DiagnosticSeverity.Error && (diagnostic.message.includes(VSCodeDiagnosticMessages.invalidPlaybookError) || diagnostic.message.includes(VSCodeDiagnosticMessages.invalidFinalizerError))) {
          // if the error is ~"playbook/finalizer is invalid" error, create codeAction

          // split on "-" to remove the diagnostic message, rejoin on "-" incase the file name had "-"
          const filename = diagnostic.message.split("-").slice(1).join("-").trim();

          // don't provide code actions to create galaxy or operator-config files here
          if (/operator-config.ya?ml$/.test(filename) || /galaxy.ya?ml$/.test(filename)) {
            continue;
          }

          // get playbook candidates, rank, and order based on the similarity of strings
          const playbooks = await workspace.gatherDirectoryPlaybooks(directory);
          const similarPlaybooks = playbooks
            .map((playbook, index) => {
              return {
                index: index,
                playbook: playbook,
                score: util.calcuateStringSimilarty(filename, playbook),
              };
            })
            .sort((a, b) => b.score - a.score) // sort candidates based on score decending
            .filter(item => item.score >= 0.5); // discard candidates with < 50% match

          let yamlKey: string = "";
          if (diagnostic.message.includes(VSCodeDiagnosticMessages.invalidFinalizerError)) {
            yamlKey = "finalizer: ";
          } else {
            yamlKey = "playbook: ";
          }

          if (similarPlaybooks.length) {
            // create actions for the top three playbooks in rank order
            const replaceActions = similarPlaybooks.slice(0, 3).map(item => {
              return this.inlineReplaceWithAction(yamlKey, item.playbook, document, range);
            });

            actions.push.apply(actions, replaceActions); // extend actions array
          }

          actions.push(
            this.createBoilerplateFileAction(filename, directory, () => {
              // if we create the file with the alternate extension, but the supplied file doesn't exist,
              // update the operator-config file with the appropriate alternate extension name
              const alternativeExtension = filename.match(/.ya?ml/)?.[0] === ".yaml" ? ".yml" : ".yaml";
              const alternativeExtensionPath = path.join(directory, filename).replace(/.ya?ml/, alternativeExtension);
              if (fs.existsSync(alternativeExtensionPath) && !fs.existsSync(path.join(directory, filename))) {
                const newFileName = workspace.pruneDirectoryStem(directory, [alternativeExtensionPath])[0];
                vscode.commands.executeCommand(VSCodeCommands.inlineReplaceWith, yamlKey + newFileName, document, range);
              }
            })
          );
        }
      }
    }

    return actions;
  }

  /**
   * Returns a vscode.CodeAction
   */
  private createGalaxyBoilerplateFile(directory: string, isPreferred: boolean = true): vscode.CodeAction {
    const actionTitle = `Create a galaxy file for \"${path.basename(directory)}\"?`;
    const action = new vscode.CodeAction(actionTitle, vscode.CodeActionKind.QuickFix);
    action.command = {
      command: VSCodeCommands.createGalaxyBoilerplateFile,
      title: actionTitle,
      arguments: [vscode.Uri.file(directory)],
    };
    action.isPreferred = isPreferred;
    return action;
  }

  /**
   * Returns a vscode.CodeAction
   */
  private createBoilerplateFileAction(filename: string, directory: string, callBack?: () => void, isPreferred: boolean = false): vscode.CodeAction {
    const actionTitle = `Create boilerplate file for "${filename}"?`;
    const action = new vscode.CodeAction(actionTitle, vscode.CodeActionKind.QuickFix);
    action.command = {
      command: VSCodeCommands.createFile,
      title: actionTitle,
      arguments: [filename, directory, callBack],
    };
    action.isPreferred = isPreferred;
    return action;
  }

  /**
   * Returns a vscode.CodeAction
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
