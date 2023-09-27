/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { LinkItem } from "../linkItems/linkItem";
import * as util from "../../utilities/util";
import { VSCodeCommands } from "../../utilities/commandConstants";

export class LinksTreeProvider implements vscode.TreeDataProvider<LinkItem> {
  getTreeItem(element: LinkItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LinkItem): LinkItem[] {
    const links: Array<LinkItem> = [];
    if (!element) {
      links.push(
        new LinkItem(
          "Operator Collection Spec",
          "Operator Collection specification documentation",
          new vscode.ThemeIcon("book"),
          util.Links.ocSpecification,
          {
            command: VSCodeCommands.openLink,
            title: "",
            arguments: [util.Links.ocSpecification],
          },
        ),
      );
      links.push(
        new LinkItem(
          "Report an SDK Issue",
          "Report an Operator Collection SDK issue",
          new vscode.ThemeIcon("bug"),
          util.Links.ocSDKIssues,
          {
            command: VSCodeCommands.openLink,
            title: "",
            arguments: [util.Links.ocSDKIssues],
          },
        ),
      );
      links.push(
        new LinkItem(
          "Report a VS Code Extension Issue",
          "Report an Operator Collection SDK VS Code extension issue",
          new vscode.ThemeIcon("bug"),
          util.Links.vscodeExtensionIssues,
          {
            command: VSCodeCommands.openLink,
            title: "",
            arguments: [util.Links.vscodeExtensionIssues],
          },
        ),
      );
      links.push(
        new LinkItem(
          "Tutorial",
          "Learn more by trying the Operator Collection development tutorial",
          new vscode.ThemeIcon("mortar-board"),
          util.Links.tutorial,
          {
            command: VSCodeCommands.openLink,
            title: "",
            arguments: [util.Links.tutorial],
          },
        ),
      );
    }

    return links;
  }
}
