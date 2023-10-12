/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as util from "../../utilities/util";
import { OperatorItem, getOperatorItems } from "../operatorItems/operatorItem";
import { ResourceItem } from "../resourceItems/resourceItem";
import { ZosEndpointItem } from "../resourceItems/zosendpointItem";
import { getZosEndpointsItem } from "../resourceItems/zosendpointsItem";
import { SubOperatorConfigItem } from "../resourceItems/subOperatorConfigItem";
import { getSubOperatorConfigsItem } from "../resourceItems/subOperatorConfigsItem";
import { OperatorCollectionItem } from "../resourceItems/operatorCollectionItem";
import { getOperatorCollectionsItem } from "../resourceItems/operatorCollectionsItem";
import { CustomResourceItem } from "../resourceItems/customResourceItem";
import { getCustomResourcesItem } from "../resourceItems/customResourcesItem";
import { KubernetesObj } from "../../kubernetes/kubernetes";
import { ResourceTreeItem } from "../resourceItems/resourceTreeItems";
import { Session } from "../../utilities/session";
import { VSCodeCommands } from "../../utilities/commandConstants";

type TreeItem = ResourceTreeItem | undefined | void;

export class ResourcesTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  // Static property to store the instances
  private static resourceTreeProviders: ResourcesTreeProvider[] = [];
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem> =
    new vscode.EventEmitter<TreeItem>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem> =
    this._onDidChangeTreeData.event;

  constructor(private readonly session: Session) {
    // Store the instances on the static property
    ResourcesTreeProvider.resourceTreeProviders.push(this);
  }
  static refreshAll(): void {
    for (const provider of ResourcesTreeProvider.resourceTreeProviders) {
      provider.refresh();
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ResourceItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ResourceTreeItem): Promise<ResourceTreeItem[]> {
    let resourceItems: Array<ResourceTreeItem> = [];
    const k8s = new KubernetesObj();
    if (this.session.loggedIntoOpenShift && 
      this.session.ocSdkInstalled && 
      this.session.zosCloudBrokerInstalled) {
      if (element) {
        // Get operator children items
        if (element instanceof OperatorItem) {
          resourceItems.push(new ZosEndpointItem(element));
          resourceItems.push(new OperatorCollectionItem(element));
          resourceItems.push(new SubOperatorConfigItem(element));
          const consoleUrl = await k8s.getOpenshifConsoleUrl();
          const apiVersion = await util.getConvertedApiVersion(
            element.workspacePath,
          );
          const operatorCsvName = await util.getOperatorCSVName(
            element.workspacePath,
          );
          const kinds = await util.getKindsInOperatorConfig(
            element.workspacePath,
          );
          if (apiVersion && operatorCsvName) {
            const customResourceCsvInstalled =
              await k8s.isCustomResourceOperatorInstalled(operatorCsvName);
            for (const kind of kinds) {
              let createCustomResourceUrl: string = "";
              if (customResourceCsvInstalled) {
                createCustomResourceUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/clusterserviceversions/${operatorCsvName}/${util.customResourceGroup}~${apiVersion}~${kind}/~new`;
              } else {
                createCustomResourceUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/${util.customResourceGroup}~${apiVersion}~${kind}/~new`;
              }
              resourceItems.push(
                new CustomResourceItem(
                  kind,
                  apiVersion,
                  operatorCsvName,
                  createCustomResourceUrl,
                ),
              );
            }
          }
          return resourceItems;
        } else if (element instanceof ZosEndpointItem) {
          return getZosEndpointsItem();
        } else if (element instanceof OperatorCollectionItem) {
          return getOperatorCollectionsItem(
            element.parentOperator.operatorName,
          );
        } else if (element instanceof SubOperatorConfigItem) {
          return getSubOperatorConfigsItem(element.parentOperator.operatorName);
        } else if (element instanceof CustomResourceItem) {
          return getCustomResourcesItem(
            element.apiVersion,
            element.kind,
            element.operatorCsvName,
          );
        }
        return [];
      } else {
        // Get root operator items
        return getOperatorItems();
      }
    }
    return resourceItems;
  }
}
