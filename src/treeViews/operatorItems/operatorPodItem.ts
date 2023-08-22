/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import {KubernetesObj} from "../../kubernetes/kubernetes";
import * as k8s from '@kubernetes/client-node';
import * as icons from "../icons";
import {OperatorTreeItem} from "./operatorTreeItems";
import {OperatorItem} from "../operatorItems/operatorItem";

export class OperatorPodItem extends OperatorTreeItem {
    constructor(public readonly podObj: k8s.V1Pod, public readonly containerStatus: Array<k8s.V1ContainerStatus>, public readonly parentOperator: OperatorItem) {
        super(`Pod: ${podObj.metadata?.name!}`, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = "operaror-pod";
		this.iconPath = icons.getPodStatusIcon(containerStatus);
    }

	contextValue = "operator-pod";
}

export async function getOperatorPodItems(parentOperator: OperatorItem): Promise<OperatorPodItem[]> {
	const operatorPodItems: Array<OperatorPodItem> = [];
	const k8s = new KubernetesObj();
	const pods = await k8s.getOperatorPods(parentOperator.operatorName);
	if (pods) {
		for (const pod of pods) {
			const containerStatus = await k8s.getOperatorContainerStatuses(parentOperator.operatorName, pod);
			operatorPodItems.push(new OperatorPodItem(pod, containerStatus, parentOperator));
		}
	}
	return operatorPodItems;
}