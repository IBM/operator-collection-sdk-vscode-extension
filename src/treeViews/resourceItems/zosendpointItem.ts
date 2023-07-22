import * as vscode from "vscode";
import {ResourceTreeItem} from "./resourceTreeItems";

export class ZosEndpointItem extends ResourceTreeItem {
    constructor() {
        super("ZosEndpoints", vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "zosendpoint";
    }
}