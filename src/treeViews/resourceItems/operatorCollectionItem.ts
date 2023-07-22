import * as vscode from "vscode";
import {ResourceTreeItem} from "./resourceTreeItems";

export class OperatorCollectionItem extends ResourceTreeItem {
    constructor() {
        super("OperatorCollections", vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "operatorcollections";
    }
}