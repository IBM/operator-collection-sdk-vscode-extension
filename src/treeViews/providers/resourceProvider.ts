import * as vscode from 'vscode';
import * as util from "../../utilities/util";
import * as path from 'path';
import {OperatorItem, getOperatorItems} from "../operatorItems/operatorItem";
import {ResourceItem} from "../resourceItems/resourceItem";
import {ZosEndpointItem} from "../resourceItems/zosendpointItem";
import {getZosEndpointsItem} from "../resourceItems/zosendpointsItem";
import {SubOperatorConfigItem} from "../resourceItems/subOperatorConfigItem";
import {getSubOperatorConfigsItem} from "../resourceItems/subOperatorConfigsItem";
import {OperatorCollectionItem} from "../resourceItems/operatorCollectionItem";
import {getOperatorCollectionsItem} from "../resourceItems/operatorCollectionsItem";
import {CustomResourceItem} from "../resourceItems/customResourceItem";
import {getCustomResourcesItem} from "../resourceItems/customResourcesItem";
import {KubernetesObj} from "../../kubernetes/kubernetes";
import {ResourceTreeItem} from "../resourceItems/resourceTreeItems";

export class ResourcesTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ResourceTreeItem | undefined | void> = new vscode.EventEmitter<ResourceTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<ResourceTreeItem | undefined | void> = this._onDidChangeTreeData.event;


	refresh(): void {
		this._onDidChangeTreeData.fire();
	}
    getTreeItem(element: ResourceItem): vscode.TreeItem {
        return element;
      }
    
    async getChildren(element?: ResourceTreeItem): Promise<ResourceTreeItem[]> {
        if (element) {
            const k8s = new KubernetesObj();
            // Get operator children items
            if (element instanceof OperatorItem) {
                let resourceItems: Array<ResourceTreeItem> = [];
                resourceItems.push(new ZosEndpointItem(element));
                resourceItems.push(new OperatorCollectionItem(element));
                resourceItems.push(new SubOperatorConfigItem(element));
                const consoleUrl = await k8s.getOpenshifConsoleUrl();
                const apiVersion = await util.getConvertedApiVersion(element.workspacePath);
                const operatorCsvName = await util.getOperatorCSVName(element.workspacePath);
                const kinds = await util.getKindsInOperatorConfig(element.workspacePath);
                if (apiVersion && operatorCsvName) {
                    for (const kind of kinds) {
                        const createCustomResourceUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/clusterserviceversions/${operatorCsvName}/${util.customResourceGroup}~${apiVersion}~${kind}/~new`;
                        resourceItems.push(new CustomResourceItem(kind, apiVersion, operatorCsvName, createCustomResourceUrl));
                    }
                }
                return resourceItems;
            } else if (element instanceof ZosEndpointItem) {
                return getZosEndpointsItem(element.parentOperator.operatorName);
            } else if (element instanceof OperatorCollectionItem) {
                return getOperatorCollectionsItem(element.parentOperator.operatorName);
            } else if (element instanceof SubOperatorConfigItem) {
                return getSubOperatorConfigsItem(element.parentOperator.operatorName);
            } else if (element instanceof CustomResourceItem) {
                return getCustomResourcesItem(element.apiVersion, element.kind, element.operatorCsvName);
            }
            return [];
        } else {
            // Get root operator items
            return getOperatorItems();
        }
    } 
}