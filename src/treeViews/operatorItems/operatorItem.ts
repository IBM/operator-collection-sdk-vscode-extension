import * as vscode from "vscode";
import * as icons from "../icons";

export class OperatorItem extends vscode.TreeItem {
    constructor(public readonly operatorDisplayName: string, public readonly operatorName: string) {
        super(`Operator: ${operatorDisplayName}`, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = "operator";
		this.iconPath = icons.getRocketIcons();
    }
}

/**
 * Retrieve the list of Operator Items
 * @returns — A promise containing the WorkSpaceOperators object
 */
export async function getOperatorItems(): Promise<OperatorItem[]> {
	let operatorItems: Array<OperatorItem> = [];
	for (const file of await vscode.workspace.findFiles("**/operator-config.*ml")) {
		let data = await vscode.workspace.openTextDocument(file);
		let operatorName = data.getText().split("name: ")[1].split("\n")[0];
		let operatorDisplayName = data.getText().split("displayName: ")[1].split("\n")[0];
		let operatorItem = new OperatorItem(operatorDisplayName, operatorName);
		operatorItems.push(operatorItem);

	}
	return operatorItems;
}