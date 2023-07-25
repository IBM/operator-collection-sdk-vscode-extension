import * as vscode from "vscode";

export class OpenShiftItem extends vscode.TreeItem {
    constructor(public readonly label: string, public readonly description: string | undefined, public readonly icon: vscode.ThemeIcon, public readonly contextValue: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = contextValue;
        this.description = description;
        this.iconPath = icon;
    }
}