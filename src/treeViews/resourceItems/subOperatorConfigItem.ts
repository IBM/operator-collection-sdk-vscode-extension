import * as vscode from "vscode";
import {ResourceTreeItem} from "./resourceTreeItems";

export class SubOperatorConfigItem extends ResourceTreeItem {
    constructor() {
        super("SubOperatorConfigs", vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "suboperatorconig";
    }
}