import * as vscode from "vscode";

export class ResourceItem extends vscode.TreeItem {
    constructor(public readonly operatorName: string) {
        super(operatorName, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "resource";
    }
}