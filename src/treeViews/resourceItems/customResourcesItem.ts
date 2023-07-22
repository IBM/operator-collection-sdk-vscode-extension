import * as vscode from "vscode";
import {KubernetesObj, ObjectInstance} from "../../kubernetes/kubernetes";
import * as icons from "../icons";
import {ResourceTreeItem} from "./resourceTreeItems";

export class CustomResourcesItem extends ResourceTreeItem {
    constructor(public readonly customResourceObj: ObjectInstance, public readonly link: string) {
        super(customResourceObj.metadata.name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "operatorcollection-object";
        this.iconPath = icons.getBrokerObjectStatusIcon(customResourceObj.status);
    }
}

export async function getCustomResourcesItem(apiVersion: string, kind: string, operatorCsvName: string): Promise<CustomResourcesItem[]> {
	const customResourceItems: Array<CustomResourcesItem> = [];
	const k8s = new KubernetesObj();
    const consoleUrl = await k8s.getOpenshifConsoleUrl();
	const customResourceList = await k8s.getCustomResources(apiVersion, `${kind}s`);
	for (const customResource of customResourceList.items) {

        let customResourceUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/clusterserviceversions/${operatorCsvName}/suboperator.zoscb.ibm.com~${apiVersion}~${kind}/${customResource.metadata.name}/yaml`;
		customResourceItems.push(new CustomResourcesItem(customResource, customResourceUrl));
	}
	return customResourceItems;
}