import * as vscode from "vscode";
import {KubernetesObj, ObjectInstance} from "../../kubernetes/kubernetes";
import * as icons from "../icons";
import {ResourceTreeItem} from "./resourceTreeItems";
import * as util from '../../utilities/util';

export class OperatorCollectionsItem extends ResourceTreeItem {
    constructor(public readonly subOperatorConfigObj: ObjectInstance, public readonly link: string) {
        super(subOperatorConfigObj.metadata.name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "operatorcollection-object";
        this.iconPath = icons.getCustomResourceStatusIcon(subOperatorConfigObj);
    }
}

export async function getOperatorCollectionsItem(operatorName: string): Promise<OperatorCollectionsItem[]> {
	const operatorCollectionItems: Array<OperatorCollectionsItem> = [];
	const k8s = new KubernetesObj();
	const operatorCollectionList = await k8s.getOperatorCollections(operatorName);
    if (operatorCollectionList) {
        for (const operatorCollection of operatorCollectionList.items) {
            let operatorCollectionUrl = await k8s.getResourceUrl(util.ZosCloudBrokerKinds.operatorCollection, util.zosCloudBrokerGroup, util.operatorCollectionApiVersion, operatorCollection.metadata.name);
            operatorCollectionItems.push(new OperatorCollectionsItem(operatorCollection, operatorCollectionUrl));
        }
    }
	return operatorCollectionItems;
}