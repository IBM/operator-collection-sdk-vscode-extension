/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { ResourceTreeItem } from "./resourceTreeItems";

export class ResourceItem extends ResourceTreeItem {
  constructor(public readonly operatorName: string) {
    super(operatorName, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "resource";
  }
}
