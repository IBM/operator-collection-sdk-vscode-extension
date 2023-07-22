import * as vscode from "vscode";
import {KubernetesObj} from "../../kubernetes/kubernetes";
import * as k8s from '@kubernetes/client-node';
import * as icons from "../icons";
import {OperatorTreeItem} from "./operatorTreeItems";


export class OperatorPodItem extends OperatorTreeItem {
    constructor(public podObj: k8s.V1Pod, public containerStatus: Array<k8s.V1ContainerStatus>) {
        super(`Pod: ${podObj.metadata?.name!}`, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = "operaror-pod";
		this.iconPath = icons.getPodStatusIcon(containerStatus);
    }

	updatePodItem(item: OperatorPodItem) {
		this.podObj = item.podObj;
		this.containerStatus = item.containerStatus;
	  }
	contextValue = "operator-pod";
}

export async function getOperatorPodItems(operatorName: string): Promise<OperatorPodItem[]> {
	const operatorPodItems: Array<OperatorPodItem> = [];
	const k8s = new KubernetesObj();
	const containerStatus = await k8s.getOperatorContainerStatuses(operatorName);
	const pods = await k8s.getOperatorPods(operatorName);
	for (const pod of pods) {
		operatorPodItems.push(new OperatorPodItem(pod, containerStatus));
	}
	return operatorPodItems;
}