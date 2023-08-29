/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import * as util from "../../utilities/util";
import {Session} from "../../utilities/session";
import {KubernetesObj} from "../../kubernetes/kubernetes";

export class CustomResourceDisplayProvider implements vscode.TextDocumentContentProvider {
    
  constructor(private readonly session: Session){}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    if (this.session.loggedIntoOpenShift) {
      const k8s = new KubernetesObj();
      const {kind, group, apiVersion, instanceName} = util.parseCustomResourceUri(uri);
      const customResource = await k8s.getCustomResourceObj(kind, instanceName, group, apiVersion);
      if (customResource) {
        const stringData = JSON.stringify(customResource, null, 2);
        const dataYaml = yaml.dump(JSON.parse(stringData));
        return dataYaml;
      }
      return "";
    }
    return "";
  }
}