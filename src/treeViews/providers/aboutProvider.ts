/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { Session } from "../../utilities/session";
import { AboutItem } from "../aboutItems/aboutItem";
import { getBrokerIcons, getOperatorCollectionSdkIcons } from "../../treeViews/icons";
import { KubernetesObj } from "../../kubernetes/kubernetes";

type TreeItem = vscode.TreeItem | undefined | void;

export class AboutTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem> = new vscode.EventEmitter<TreeItem>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem> = this._onDidChangeTreeData.event;

  constructor(private readonly session: Session) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    const k8s = new KubernetesObj();
    const aboutItems: Array<AboutItem> = [];
    const brokerIcons = getBrokerIcons() as vscode.ThemeIcon;
    const ocSdkIcons = getOperatorCollectionSdkIcons() as vscode.ThemeIcon;
    if (this.session.loggedIntoOpenShift && this.session.zosCloudBrokerInstalled) {
      const zosCloudBrokerRelease = await k8s.getZosCloudBrokerRelease();
      if (!element) {
        if (zosCloudBrokerRelease !== undefined) {
          aboutItems.push(new AboutItem("IBM z/OS Cloud Broker", zosCloudBrokerRelease, brokerIcons));
        } else {
          aboutItems.push(new AboutItem("IBM z/OS Cloud Broker", "operator unavailable - version unknown", ocSdkIcons));
        }
      }
    }
    if (this.session.ocSdkInstalled) {
      if (!element) {
        const ocSdkVersion = await this.session.ocSdkVersion();
        aboutItems.push(new AboutItem("IBM Operator Collection SDK", ocSdkVersion!, ocSdkIcons));
      }
    }
    return aboutItems;
  }
}
