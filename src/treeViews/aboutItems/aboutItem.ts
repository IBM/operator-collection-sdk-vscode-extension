/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";

export class AboutItem extends vscode.TreeItem {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly icon:
      | vscode.ThemeIcon
      | {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
  ) {
    super(name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "about";
    this.description = description;
    this.iconPath = icon;
  }
}
