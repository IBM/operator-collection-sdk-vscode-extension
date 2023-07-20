import * as vscode from "vscode";

export class OperatorCollectionItem extends vscode.TreeItem {
    constructor() {
        super("OperatorCollections", vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "operatorcollections";
    }
}