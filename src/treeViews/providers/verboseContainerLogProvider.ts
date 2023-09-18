/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as util from "../../utilities/util";
import { Session } from "../../utilities/session";
import { KubernetesObj } from "../../kubernetes/kubernetes";

export class VerboseContainerLogProvider
  implements vscode.TextDocumentContentProvider
{
  // Static property to store the instances
  private static verboseContainerLogProviders: VerboseContainerLogProvider[] =
    [];

  constructor(private readonly session: Session) {
    // Store the instances on the static property
    VerboseContainerLogProvider.verboseContainerLogProviders.push(this);
  }

  static async updateSession(): Promise<void> {
    for (const provider of VerboseContainerLogProvider.verboseContainerLogProviders) {
      await provider.session.validateOcSDKInstallation();
      await provider.session.validateOpenShiftAccess();
    }
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
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
      return "";
    }
    return "";
  }
}
