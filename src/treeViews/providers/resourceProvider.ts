import * as vscode from 'vscode';
import {OperatorItem, getOperatorItems} from "../operatorItems/operatorItem";
import {ResourceItem} from "../resourceItems/resourceItem";
import {ZosEndpointItem} from "../resourceItems/zosendpointItem";
import {ZosEndpointsItem, getZosEndpointsItem} from "../resourceItems/zosendpointsItem";

type ResourceTreeItems = OperatorItem | ZosEndpointItem | ZosEndpointsItem;

export class ResourcesTreeProvider implements vscode.TreeDataProvider<ResourceTreeItems> {
    private operatorName: string = "";
    getTreeItem(element: ResourceItem): vscode.TreeItem {
        if (element instanceof OperatorItem) {
            this.operatorName = element.operatorName;
          }
        return element;
      }
    
    async getChildren(element?: ResourceItem): Promise<ResourceTreeItems[]> {
        if (element) {
            // Get operator children items
            // Get operator children items
            if (element instanceof OperatorItem) {
                let zosendpointItems: Array<ResourceTreeItems> = [];
                zosendpointItems.push(new ZosEndpointItem());
                return zosendpointItems;
            } else if (element instanceof ZosEndpointItem) {
                return getZosEndpointsItem(this.operatorName);
            }
            return [];
        } else {
            // Get root operator items
            return getOperatorItems();
        }
    } 
}