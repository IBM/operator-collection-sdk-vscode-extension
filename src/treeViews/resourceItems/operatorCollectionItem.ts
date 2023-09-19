/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { ResourceTreeItem } from "./resourceTreeItems";
import { OperatorItem } from "../operatorItems/operatorItem";

export class OperatorCollectionItem extends ResourceTreeItem {
  constructor(public readonly parentOperator: OperatorItem) {
    super("OperatorCollections", vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "operatorcollections";
  }
}
