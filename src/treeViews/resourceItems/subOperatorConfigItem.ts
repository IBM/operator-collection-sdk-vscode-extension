import * as vscode from "vscode";

export class SubOperatorConfigItem extends vscode.TreeItem {
    constructor() {
        super("SubOperatorConfigs", vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "suboperatorconig";
    }
}