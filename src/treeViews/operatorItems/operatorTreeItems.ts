/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";

export abstract class OperatorTreeItem extends vscode.TreeItem {
  contextValue = "operator-tree-item";
  operatorName = "";
  workspacePath = "";
}
