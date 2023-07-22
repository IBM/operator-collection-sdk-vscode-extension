import * as vscode from "vscode";
import {ResourceTreeItem} from "./resourceTreeItems";

export class CustomResourceItem extends ResourceTreeItem {
    constructor(public readonly kind: string, public readonly apiVersion: string, public readonly operatorCsvName: string, public readonly link: string) {
        super(`${kind}s`, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = "customresources";
    }
}