import * as vscode from "vscode";
import {KubernetesObj} from "../../kubernetes/kubernetes";
import * as k8s from '@kubernetes/client-node';
import * as icons from "../icons";

export class OperatorContainerItem extends vscode.TreeItem {
    constructor(public readonly podObj: k8s.V1Pod, public readonly containerStatus: k8s.V1ContainerStatus, public readonly operatorName: string) {
        super(`Container: ${containerStatus.name}`, vscode.TreeItemCollapsibleState.None);
		if (containerStatus.name.startsWith("init")) {
			this.contextValue = "operator-init-container";
		} else {
			this.contextValue = "operator-container";
		}
		this.iconPath = icons.getPodContainerStatusIconPath(containerStatus);
    }
}

export async function getOperatorContainerItems(operatorName: string): Promise<OperatorContainerItem[]> {
	const operatorContainerItems: Array<OperatorContainerItem> = [];
	const k8s = new KubernetesObj();
	const pods = await k8s.getOperatorPods(operatorName);
	const containerStatuses = await k8s.getOperatorContainerStatuses(operatorName);
	for (const containerStatus of containerStatuses) {
		operatorContainerItems.push(new OperatorContainerItem(pods[0], containerStatus, operatorName));
	}
	return operatorContainerItems;
}

