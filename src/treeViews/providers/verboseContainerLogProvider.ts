/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as util from "../../utilities/util";
import { Session } from "../../utilities/session";
import { KubernetesObj } from "../../kubernetes/kubernetes";
import { VSCodeCommands } from "../../utilities/commandConstants";

export class VerboseContainerLogProvider
  implements vscode.TextDocumentContentProvider
{

  constructor(private readonly session: Session) {}

  onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange = this.onDidChangeEmitter.event;

  refresh(uri: vscode.Uri): void {
    this.onDidChangeEmitter.fire(uri);
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string | undefined> {
    if (this.session.loggedIntoOpenShift) {
      const k8s = new KubernetesObj();
      const uriObj = util.parseVerboseContainerLogUri(uri);
      const logData = await k8s.downloadVerboseContainerLogs(
        uriObj.podName,
        uriObj.containerName,
        uriObj.apiVersion,
        uriObj.kind,
        uriObj.instanceName,
      );
      if (logData) {
        return logData;
      }
      return undefined;
    }
  }
}
