import * as vscode from "vscode";

export class CustomResourceItem extends vscode.TreeItem {
    constructor(public readonly kind: string, public readonly apiVersion: string, public readonly operatorCsvName: string, public readonly link: string) {
        super(`${kind}s`, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "customresources";
    }
}