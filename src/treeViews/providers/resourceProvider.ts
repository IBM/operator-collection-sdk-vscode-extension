import * as vscode from 'vscode';
import {getOperatorItems} from "../operatorItems/operatorItem";
import {ResourceItem} from "../resourceItems/resourceItem";

export class ResourcesTreeProvider implements vscode.TreeDataProvider<ResourceItem> {
    getTreeItem(element: ResourceItem): vscode.TreeItem {
        return element;
      }
    
    async getChildren(element?: ResourceItem): Promise<ResourceItem[]> {
        let resourceItems: Array<ResourceItem> = []; 
        if (element) {
            return resourceItems;
        }

        let operatorItems = getOperatorItems();
        for (const operatorItem of await operatorItems) {
            let operatorName = operatorItem.operatorName;
            resourceItems.push(new ResourceItem(operatorName));
        }
        return getOperatorItems();
    } 
}