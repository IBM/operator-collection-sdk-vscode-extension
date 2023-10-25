/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { KubernetesObj, ObjectInstance } from "../../kubernetes/kubernetes";
import * as icons from "../icons";
import { ResourceTreeItem } from "./resourceTreeItems";
import * as util from "../../utilities/util";

export class ZosEndpointsItem extends ResourceTreeItem {
  constructor(
    public readonly zosendpointObj: ObjectInstance,
    public readonly link: string
  ) {
    super(zosendpointObj.metadata.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "zosendpoint-object";
    this.iconPath = icons.getCustomResourceStatusIcon(zosendpointObj);
  }
}

export async function getZosEndpointsItem(): Promise<ZosEndpointsItem[]> {
  const zosendpointItems: Array<ZosEndpointsItem> = [];
  const k8s = new KubernetesObj();
  const consoleUrl = await k8s.getOpenshifConsoleUrl();
  const zosendpointList = await k8s.getZosEndpoints();
  if (zosendpointList) {
    for (const zosendpoint of zosendpointList.items) {
      let zosendpointUrl = await k8s.getResourceUrl(util.ZosCloudBrokerKinds.zosEndpoint, util.zosCloudBrokerGroup, util.zosEndpointApiVersion, zosendpoint.metadata.name);
      zosendpointItems.push(new ZosEndpointsItem(zosendpoint, zosendpointUrl));
    }
  }
  return zosendpointItems;
}
