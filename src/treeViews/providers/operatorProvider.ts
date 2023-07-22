import * as vscode from 'vscode';
import {OperatorItem, getOperatorItems} from "../operatorItems/operatorItem";
import {OperatorPodItem, getOperatorPodItems} from "../operatorItems/operatorPodItem";
import {OperatorContainerItem, getOperatorContainerItems} from "../operatorItems/operatorContainerItem";

type OperatorTreeItems = OperatorItem | OperatorPodItem | OperatorContainerItem;

export class OperatorsTreeProvider implements vscode.TreeDataProvider<OperatorTreeItems> {
  private operatorName: string = "";
   private _onDidChangeTreeData: vscode.EventEmitter<OperatorItem | undefined | void> = new vscode.EventEmitter<OperatorItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<OperatorItem | undefined | void> = this._onDidChangeTreeData.event;
    
  refresh(): void {
      this._onDidChangeTreeData.fire();
  }
  getTreeItem(element: OperatorTreeItems): vscode.TreeItem {
    if (element instanceof OperatorItem) {
      this.operatorName = element.operatorName;
    }
    return element;
  }
  
  async getChildren(element?: OperatorTreeItems): Promise<OperatorTreeItems[]> {
    if (element) {
      // Get operator children items
        if (element instanceof OperatorItem) {
          return getOperatorPodItems(this.operatorName);
        } else if (element instanceof OperatorPodItem) {
          return getOperatorContainerItems(this.operatorName);
        }
        return [];
    } else {
      // Get root operator items
        return getOperatorItems();
    }
  } 
}