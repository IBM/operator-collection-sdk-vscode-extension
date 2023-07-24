import * as vscode from "vscode";

export class LinkItem extends vscode.TreeItem {
    constructor(public readonly name: string, public readonly description: string, public readonly icon: vscode.ThemeIcon, public readonly link: string) {
        super(name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "links";
        this.description = description;
        this.iconPath = icon;
    }
}