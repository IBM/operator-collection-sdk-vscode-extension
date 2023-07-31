/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as icons from "../icons";
import * as util from "../../utilities/util";
import * as path from 'path';
import {OperatorTreeItem} from "./operatorTreeItems";

export class OperatorItem extends OperatorTreeItem {
    constructor(public readonly operatorDisplayName: string, public readonly operatorName: string, public readonly workspacePath: string) {
        super(`Operator: ${operatorDisplayName}`, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = "operator";
		this.iconPath = icons.getRocketIcons();
    }
	contextValue = "operator";
}

/**
 * Retrieve the list of Operator Items
 * @returns — A promise containing the WorkSpaceOperators object
 */
export async function getOperatorItems(): Promise<OperatorItem[]> {
	let operatorItems: Array<OperatorItem> = [];
	for (const file of await vscode.workspace.findFiles("**/operator-config.*ml")) {
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