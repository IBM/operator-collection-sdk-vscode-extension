import * as vscode from "vscode";
import {KubernetesObj, ObjectInstance} from "../../kubernetes/kubernetes";
import * as icons from "../icons";
import {ResourceTreeItem} from "./resourceTreeItems";

export class OperatorCollectionsItem extends ResourceTreeItem {
    constructor(public readonly subOperatorConfigObj: ObjectInstance, public readonly link: string) {
        super(subOperatorConfigObj.metadata.name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "operatorcollection-object";
        this.iconPath = icons.getBrokerObjectStatusIcon(subOperatorConfigObj.status);
    }
}

export async function getOperatorCollectionsItem(operatorName: string): Promise<OperatorCollectionsItem[]> {
	const operatorCollectionItems: Array<OperatorCollectionsItem> = [];
	const k8s = new KubernetesObj();
    const consoleUrl = await k8s.getOpenshifConsoleUrl();
	const operatorCollectionList = await k8s.getOperatorCollections(operatorName);
	for (const operatorCollection of operatorCollectionList.items) {
        let operatorCollectionUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/zoscb.ibm.com~v2beta2~OperatorCollection/${operatorCollection.metadata.name}/yaml`;
		operatorCollectionItems.push(new OperatorCollectionsItem(operatorCollection, operatorCollectionUrl));
	}
	return operatorCollectionItems;
}