import * as vscode from "vscode";
import {KubernetesObj} from "../../kubernetes/kubernetes";
import * as k8s from '@kubernetes/client-node';
import * as icons from "../icons";
import {OperatorTreeItem} from "./operatorTreeItems";
import {OperatorPodItem} from "./operatorPodItem";

export class OperatorContainerItem extends OperatorTreeItem {
    constructor(public readonly podObj: k8s.V1Pod, public readonly containerStatus: k8s.V1ContainerStatus, public readonly operatorName: string) {
        super(`Container: ${containerStatus.name}`, vscode.TreeItemCollapsibleState.None);
		if (containerStatus.name.startsWith("init")) {
			this.contextValue = "operator-init-container";
		} else {
			this.contextValue = "operator-container";
		}
		this.iconPath = icons.getPodContainerStatusIcon(containerStatus);
    }
}

export async function getOperatorContainerItems(operatorName: string, podItem: OperatorPodItem): Promise<OperatorContainerItem[]> {
	const operatorContainerItems: Array<OperatorContainerItem> = [];
	const k8s = new KubernetesObj();
	const containerStatuses = await k8s.getOperatorContainerStatuses(operatorName, podItem.podObj);
	for (const containerStatus of containerStatuses) {
		operatorContainerItems.push(new OperatorContainerItem(podItem.podObj, containerStatus, operatorName));
	}
	
	return operatorContainerItems;
}

