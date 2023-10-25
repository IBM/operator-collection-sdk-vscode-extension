/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { KubernetesObj } from "../../kubernetes/kubernetes";
import * as k8s from "@kubernetes/client-node";
import * as icons from "../icons";
import { OperatorTreeItem } from "./operatorTreeItems";
import { OperatorItem } from "../operatorItems/operatorItem";

export class OperatorPodItem extends OperatorTreeItem {
  constructor(
    public readonly podObj: k8s.V1Pod,
    public readonly containerStatus: Array<k8s.V1ContainerStatus>,
    public readonly parentOperator: OperatorItem
  ) {
    super(`Pod: ${podObj.metadata?.name!}`, vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = "operaror-pod";
    this.iconPath = icons.getPodStatusIcon(containerStatus);
    parentOperator.updatePodItems(this);
  }

  contextValue = "operator-pod";
}

export async function getOperatorPodItems(parentOperator: OperatorItem): Promise<OperatorPodItem[]> {
  const operatorPodItems: Array<OperatorPodItem> = [];
  const k8s = new KubernetesObj();
  return k8s
    .getOperatorPods(parentOperator.operatorName)
    .then(pods => {
      if (pods) {
        for (const pod of pods) {
          k8s
            .getOperatorContainerStatuses(parentOperator.operatorName, pod)
            .then(containerStatus => {
              operatorPodItems.push(new OperatorPodItem(pod, containerStatus, parentOperator));
            })
            .catch(e => {
              throw new Error(e);
            });
        }
      }
      return operatorPodItems;
    })
    .catch(e => {
      throw new Error(e);
    });
}
