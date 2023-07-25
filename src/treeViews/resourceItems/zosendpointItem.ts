import * as vscode from "vscode";
import {ResourceTreeItem} from "./resourceTreeItems";
import {OperatorItem} from "../operatorItems/operatorItem";

export class ZosEndpointItem extends ResourceTreeItem {
    constructor(public readonly parentOperator: OperatorItem) {
        super("ZosEndpoints", vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "zosendpoint";
    }
}