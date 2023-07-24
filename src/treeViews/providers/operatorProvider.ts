import * as vscode from 'vscode';
import {OperatorItem, getOperatorItems} from "../operatorItems/operatorItem";
import {OperatorPodItem, getOperatorPodItems} from "../operatorItems/operatorPodItem";
import {getOperatorContainerItems} from "../operatorItems/operatorContainerItem";
import {OperatorTreeItem} from "../operatorItems/operatorTreeItems";

export class OperatorsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private operatorName: string = "";
  private _onDidChangeTreeData: vscode.EventEmitter<OperatorTreeItem | undefined | void> = new vscode.EventEmitter<OperatorTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<OperatorTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

  getTreeItem(element: OperatorTreeItem): vscode.TreeItem {
    return element;
  }
  
  getChildren(element?: OperatorTreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
    const tree: Array<vscode.TreeItem> = [];
    if (element) {
      // Get operator children items
        if (element instanceof OperatorItem) {
          return getOperatorPodItems(element);
        } else if (element instanceof OperatorPodItem) {
          return getOperatorContainerItems(element);
        }
    } else {
      // Get root operator items
        return getOperatorItems();
     }
    return tree;
  } 
}