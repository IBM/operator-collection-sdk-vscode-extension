/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as icons from "../icons";
import * as util from "../../utilities/util";
import * as path from "path";
import { OperatorTreeItem } from "./operatorTreeItems";
import { OperatorPodItem, getOperatorPodItems } from "./operatorPodItem";

export class OperatorItem extends OperatorTreeItem {
  // Static property to store the instances
  private static operatorItems: OperatorItem[] = [];
  public podItems: OperatorPodItem[] = [];

  constructor(
    public readonly operatorDisplayName: string,
    public readonly operatorName: string,
    public readonly workspacePath: string
  ) {
    super(`Operator: ${operatorDisplayName}`, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "operator";
    this.iconPath = icons.getOperatorCollectionSdkIcons();

    // Store the instances on the static property
    this.updateExistingOperatorItemOrAppendNewItem(this);
  }
  contextValue = "operator";

  private async updateExistingOperatorItemOrAppendNewItem(operatorItem: OperatorItem) {
    operatorItem.podItems = await getOperatorPodItems(operatorItem);
    if (OperatorItem.operatorItems.length > 0) {
      const operatorItemIndex = (OperatorItem.operatorItems as any[]).findIndex(item => (item as OperatorItem).operatorName === operatorItem.operatorName);
      if (operatorItemIndex > -1) {
        OperatorItem.operatorItems[operatorItemIndex] = operatorItem;
      } else {
        OperatorItem.operatorItems.push(operatorItem);
      }
    } else {
      OperatorItem.operatorItems.push(operatorItem);
    }
  }

  updatePodItems(podItem: OperatorPodItem) {
    if (this.podItems.length > 0) {
      const podItemIndex = (this.podItems as any[]).findIndex(item => (item as OperatorPodItem).podObj.metadata?.name === podItem.podObj.metadata?.name);
      if (podItemIndex > -1) {
        this.podItems[podItemIndex] = podItem;
      } else {
        this.podItems.push(podItem);
      }
    } else {
      this.podItems.push(podItem);
    }
  }

  syncPodItems(operatorName: string, podItems: OperatorPodItem[]) {
    this.podItems = podItems;

    // Update instances in static property
    const operatorItem = OperatorItem.getOperatorItemByName(operatorName);
    if (operatorItem !== undefined) {
      operatorItem.podItems = podItems;
      this.updateExistingOperatorItemOrAppendNewItem(operatorItem);
    }
  }

  static getOperatorItemByName(operatorName: string): OperatorItem | undefined {
    for (const item of this.operatorItems) {
      if (item.operatorName === operatorName) {
        return item;
      }
    }
    return undefined;
  }
}

/**
 * Retrieve the list of Operator Items
 * @returns — A promise containing the WorkSpaceOperators object
 */
export async function getOperatorItems(): Promise<OperatorItem[]> {
  const operatorItems: Array<OperatorItem> = [];
  const files = await vscode.workspace.findFiles("**/operator-config.*ml");
  files.sort();
  for (const file of files) {
    const operatorConigFilePath = file.fsPath;
    const workspacePath = path.parse(operatorConigFilePath).dir;
    let data = await vscode.workspace.openTextDocument(file);
    if (util.validateOperatorConfig(data)) {
      let operatorName = data.getText().split("name: ")[1].split("\n")[0];
      let operatorDisplayName = data.getText().split("displayName: ")[1].split("\n")[0];
      let operatorItem = new OperatorItem(operatorDisplayName, operatorName, workspacePath);
      operatorItems.push(operatorItem);
    }
  }
  return operatorItems;
}
