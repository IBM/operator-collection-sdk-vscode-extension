/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { Session } from "../../utilities/session";
import { getBrokerIconPath } from "../../utilities/util";

type TreeItem = vscode.TreeItem | undefined | void;

export class AboutTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem> =
    new vscode.EventEmitter<TreeItem>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem> =
    this._onDidChangeTreeData.event;

  constructor(private readonly session: Session) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    const items: Array<vscode.TreeItem> = [];
    const ocSdkVersionInstalled = this.session.ocSdkVersion();
    return Promise.all([ocSdkVersionInstalled]).then((values) => {
      if (!element) {
        const ocsdkVersionItem = new vscode.TreeItem(
          `Operator Collection SDK v${values[0]}`,
          vscode.TreeItemCollapsibleState.None,
        );
        ocsdkVersionItem.iconPath = {
          light: getBrokerIconPath("light"),
          dark: getBrokerIconPath("dark"),
        };
        items.push(ocsdkVersionItem);
      }
      return items;
    });
  }
}
