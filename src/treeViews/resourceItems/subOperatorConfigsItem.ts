/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { KubernetesObj, ObjectInstance } from "../../kubernetes/kubernetes";
import * as icons from "../icons";
import { ResourceTreeItem } from "./resourceTreeItems";
import * as util from "../../utilities/util";

export class SubOperatorConfigsItem extends ResourceTreeItem {
  constructor(
    public readonly subOperatorConfigObj: ObjectInstance,
    public readonly link: string
  ) {
    super(subOperatorConfigObj.metadata.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "suboperatorconfig-object";
    this.iconPath = icons.getCustomResourceStatusIcon(subOperatorConfigObj);
  }
}

export async function getSubOperatorConfigsItem(operatorName: string): Promise<SubOperatorConfigsItem[]> {
  const subOperatorConfigItems: Array<SubOperatorConfigsItem> = [];
  const k8s = new KubernetesObj();
  const subOperatorConfigList = await k8s.getSubOperatorConfigs(operatorName);
  if (subOperatorConfigList) {
    for (const subOperatorConfig of subOperatorConfigList.items) {
      let subOperatorConfigUrl = await k8s.getResourceUrl(util.ZosCloudBrokerKinds.subOperatorConfig, util.zosCloudBrokerGroup, util.subOperatorConfigApiVersion, subOperatorConfig.metadata.name);
      subOperatorConfigItems.push(new SubOperatorConfigsItem(subOperatorConfig, subOperatorConfigUrl));
    }
  }
  return subOperatorConfigItems;
}
