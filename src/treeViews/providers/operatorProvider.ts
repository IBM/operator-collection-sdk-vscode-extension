/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { OperatorItem, getOperatorItems } from "../operatorItems/operatorItem";
import { OperatorPodItem, getOperatorPodItems } from "../operatorItems/operatorPodItem";
import { getOperatorContainerItems } from "../operatorItems/operatorContainerItem";
import { OperatorTreeItem } from "../operatorItems/operatorTreeItems";
import { Session } from "../../utilities/session";

type TreeItem = OperatorTreeItem | undefined | void;

export class OperatorsTreeProvider implements vscode.TreeDataProvider<OperatorTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem> = new vscode.EventEmitter<TreeItem>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem> = this._onDidChangeTreeData.event;

  constructor(private readonly session: Session) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: OperatorTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: OperatorTreeItem): Promise<OperatorTreeItem[]> {
    const operatorTreeItems: Array<OperatorTreeItem> = [];

    if (this.session.loggedIntoOpenShift && this.session.ocSdkInstalled && this.session.zosCloudBrokerInstalled && !this.session.ocSdkOutdated) {
      if (element) {
        // Get operator children items
        if (element instanceof OperatorItem) {
          return getOperatorPodItems(element)
            .then(operatorPodItems => {
              element.syncPodItems(element.operatorName, operatorPodItems);
              return operatorPodItems;
            })
            .catch(e => {
              vscode.window.showErrorMessage(`Failure retrieving pods list: ${e}`);
              return [];
            });
        } else if (element instanceof OperatorPodItem) {
          return getOperatorContainerItems(element);
        }
      } else {
        // Get root operator items
        return getOperatorItems();
      }
    }
    return operatorTreeItems;
  }
}
