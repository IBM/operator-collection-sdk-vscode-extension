import * as vscode from "vscode";
import {KubernetesObj, ObjectInstance} from "../../kubernetes/kubernetes";
import * as icons from "../icons";

export class ZosEndpointsItem extends vscode.TreeItem {
    constructor(public readonly zosendpointObj: ObjectInstance, link: string) {
        super(zosendpointObj.metadata.name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "zosendpoint-object";
        this.iconPath = icons.getBrokerObjectStatusIconPath(zosendpointObj.status);
        this.resourceUri = vscode.Uri.parse(link);
        this.command = {
            command: "operator-collection-sdk.openLink",
            title: '',
            arguments: [this.resourceUri],
        };
    }
}

export async function getZosEndpointsItem(operatorName: string): Promise<ZosEndpointsItem[]> {
	const zosendpointItems: Array<ZosEndpointsItem> = [];
	const k8s = new KubernetesObj();
    const consoleUrl = await k8s.getOpenshifConsoleUrl();
    //https://console-openshift-console.zoscb-pentest-42d4bdeacfebc108744a5d18dc2f0439-0000.us-east.containers.appdomain.cloud/k8s/ns/latrell-test/zoscb.ibm.com~v2beta2~ZosEndpoint/ibmcloud-vm/yaml
    
	const zosendpointList = await k8s.getZosEndpoints(operatorName);
	for (const zosendpoint of zosendpointList.items) {
        let zosendpointUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/zoscb.ibm.com~v2beta2~ZosEndpoint/${zosendpoint.metadata.name}/yaml`;
		zosendpointItems.push(new ZosEndpointsItem(zosendpoint, zosendpointUrl));
	}
	return zosendpointItems;
}