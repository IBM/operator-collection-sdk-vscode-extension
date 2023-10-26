/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { KubernetesObj, ObjectInstance } from "../../kubernetes/kubernetes";
import * as icons from "../icons";
import { ResourceTreeItem } from "./resourceTreeItems";
import * as util from "../../utilities/util";

export class CustomResourcesItem extends ResourceTreeItem {
  constructor(
    public readonly customResourceObj: ObjectInstance,
    public readonly link: string,
    public readonly operatorName: string
  ) {
    super(customResourceObj.metadata.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "customresource-object";
    this.iconPath = icons.getCustomResourceStatusIcon(customResourceObj);
  }
}

export async function getCustomResourcesItem(apiVersion: string, kind: string, operatorName: string, operatorCsvName: string): Promise<CustomResourcesItem[]> {
  const customResourceItems: Array<CustomResourcesItem> = [];
  const k8s = new KubernetesObj();
  const customResourceList = await k8s.getCustomResources(apiVersion, kind);
  if (customResourceList) {
    for (const customResource of customResourceList.items) {
      let customResourceUrl = await k8s.getResourceUrl(kind, util.customResourceGroup, apiVersion, customResource.metadata.name, operatorCsvName);
      customResourceItems.push(new CustomResourcesItem(customResource, customResourceUrl, operatorName));
    }
  }
  return customResourceItems;
}
