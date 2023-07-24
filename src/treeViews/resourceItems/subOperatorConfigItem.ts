import * as vscode from "vscode";
import {ResourceTreeItem} from "./resourceTreeItems";
import {OperatorItem} from "../operatorItems/operatorItem";

export class SubOperatorConfigItem extends ResourceTreeItem {
    constructor(public readonly parentOperator: OperatorItem) {
        super("SubOperatorConfigs", vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "suboperatorconig";
    }
}