import * as vscode from "vscode";

export class ZosEndpointItem extends vscode.TreeItem {
    constructor() {
        super("ZosEndpoints", vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = "zosendpoint";
    }
}