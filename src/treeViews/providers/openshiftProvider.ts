/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { OpenShiftItem } from "../openshiftItems/openshiftItem";
import { KubernetesObj } from "../../kubernetes/kubernetes";
import { Session } from "../../utilities/session";

type TreeItem = OpenShiftItem | undefined | void;

export class OpenShiftTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  // Static property to store the instances
  private static openshiftTreeProviders: OpenShiftTreeProvider[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem> =
    new vscode.EventEmitter<TreeItem>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem> =
    this._onDidChangeTreeData.event;

  constructor(private readonly session: Session) {
    // Store the instances on the static property
    OpenShiftTreeProvider.openshiftTreeProviders.push(this);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OpenShiftItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: OpenShiftItem): Promise<OpenShiftItem[]> {
    const links: Array<OpenShiftItem> = [];
    const k8s = new KubernetesObj();
    if (this.session.loggedIntoOpenShift) {
      links.push(
        new OpenShiftItem(
          "OpenShift Cluster",
          k8s.openshiftServerURL,
          new vscode.ThemeIcon("cloud"),
          "openshift-cluster",
        ),
      );
      links.push(
        new OpenShiftItem(
          "OpenShift Namespace",
          k8s.namespace,
          new vscode.ThemeIcon("account"),
          "openshift-namespace",
        ),
      );
    }

    return links;
  }
}
