/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as util from "../../utilities/util";
import { Session } from "../../utilities/session";
import { KubernetesObj } from "../../kubernetes/kubernetes";

export class ContainerLogProvider
  implements vscode.TextDocumentContentProvider
{
  // Static property to store the instances
  private static containerLogProviders: ContainerLogProvider[] = [];

  constructor(private readonly session: Session) {
    // Store the instances on the static property
    ContainerLogProvider.containerLogProviders.push(this);
  }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    if (this.session.loggedIntoOpenShift) {
      const k8s = new KubernetesObj();
      const { podName, containerName } = util.parseContainerLogUri(uri);
      const logData = await k8s.downloadContainerLogs(podName, containerName);
      if (logData) {
        return logData;
      }
      return "";
    }
    return "";
  }
}
