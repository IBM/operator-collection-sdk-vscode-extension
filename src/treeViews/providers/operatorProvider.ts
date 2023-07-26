import * as vscode from 'vscode';
import {OperatorItem, getOperatorItems} from "../operatorItems/operatorItem";
import {OperatorPodItem, getOperatorPodItems} from "../operatorItems/operatorPodItem";
import {getOperatorContainerItems} from "../operatorItems/operatorContainerItem";
import {OperatorTreeItem} from "../operatorItems/operatorTreeItems";
import {Session} from "../../utilities/session";

type TreeItem = OperatorTreeItem | undefined | void;

export class OperatorsTreeProvider implements vscode.TreeDataProvider<OperatorTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem> = new vscode.EventEmitter<TreeItem>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem> = this._onDidChangeTreeData.event;

  constructor(private readonly session: Session){}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

  getTreeItem(element: OperatorTreeItem): vscode.TreeItem {
    return element;
  }
  
  async getChildren(element?: OperatorTreeItem): Promise<OperatorTreeItem[]> {
    const operatorTreeItems: Array<OperatorTreeItem> = [];

    if (this.session.loggedIntoOpenShift && this.session.ocSdkInstalled) {
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
    } 
    return operatorTreeItems;
  } 
}