import * as vscode from "vscode";
import * as icons from "../icons";
import * as util from "../../utilities/util";
import {OperatorTreeItem} from "./operatorTreeItems";

export class OperatorItem extends OperatorTreeItem {
    constructor(public readonly operatorDisplayName: string, public readonly operatorName: string) {
        super(`Operator: ${operatorDisplayName}`, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = "operator";
		this.iconPath = new vscode.ThemeIcon("rocket");;
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
		let data = await vscode.workspace.openTextDocument(file);
		if (util.validateOperatorConfig(data)) {
			let operatorName = data.getText().split("name: ")[1].split("\n")[0];
			let operatorDisplayName = data.getText().split("displayName: ")[1].split("\n")[0];
			let operatorItem = new OperatorItem(operatorDisplayName, operatorName);
			operatorItems.push(operatorItem);
		}

	}
	return operatorItems;
}