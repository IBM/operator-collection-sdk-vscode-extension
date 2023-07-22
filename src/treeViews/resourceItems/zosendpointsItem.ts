import * as vscode from "vscode";
import {KubernetesObj, ObjectInstance} from "../../kubernetes/kubernetes";
import * as icons from "../icons";
import {ResourceTreeItem} from "./resourceTreeItems";

export class ZosEndpointsItem extends ResourceTreeItem {
    constructor(public readonly zosendpointObj: ObjectInstance, public readonly link: string) {
        super(zosendpointObj.metadata.name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "zosendpoint-object";
        this.iconPath = icons.getBrokerObjectStatusIcon(zosendpointObj.status);
    }
}

export async function getZosEndpointsItem(operatorName: string): Promise<ZosEndpointsItem[]> {
	const zosendpointItems: Array<ZosEndpointsItem> = [];
	const k8s = new KubernetesObj();
    const consoleUrl = await k8s.getOpenshifConsoleUrl();
	const zosendpointList = await k8s.getZosEndpoints(operatorName);
	for (const zosendpoint of zosendpointList.items) {
        let zosendpointUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/zoscb.ibm.com~v2beta2~ZosEndpoint/${zosendpoint.metadata.name}/yaml`;
		zosendpointItems.push(new ZosEndpointsItem(zosendpoint, zosendpointUrl));
	}
	return zosendpointItems;
}