/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as icons from "../icons";
import * as util from "../../utilities/util";
import * as path from "path";
import { OperatorTreeItem } from "./operatorTreeItems";
import { OperatorPodItem } from "./operatorPodItem";

export class OperatorItem extends OperatorTreeItem {
  // Static property to store the instances
  private static operatorItems: OperatorItem[] = [];
  public podItem: OperatorPodItem;

  constructor(
    public readonly operatorDisplayName: string,
    public readonly operatorName: string,
    public readonly workspacePath: string,
  ) {
    super(
      `Operator: ${operatorDisplayName}`,
      vscode.TreeItemCollapsibleState.Expanded,
    );
    this.contextValue = "operator";
    this.iconPath = icons.getOperatorCollectionSdkIcons();

    // Store the instances on the static property
    OperatorItem.operatorItems.push(this);
  }
  contextValue = "operator";

  updatePodItem(podItem: OperatorPodItem) {
    this.podItem = podItem;
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
      let operatorDisplayName = data
        .getText()
        .split("displayName: ")[1]
        .split("\n")[0];
      let operatorItem = new OperatorItem(
        operatorDisplayName,
        operatorName,
        workspacePath,
      );
      operatorItems.push(operatorItem);
    }
  }
  return operatorItems;
}
