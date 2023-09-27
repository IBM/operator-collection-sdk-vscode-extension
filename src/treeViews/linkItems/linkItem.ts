/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";

export class LinkItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly icon: vscode.ThemeIcon,
    public readonly link: string,
    public readonly command: vscode.Command,
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "links";
    this.description = description;
    this.iconPath = icon;
    this.command = command;
  }
}
