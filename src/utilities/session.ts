/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { OcSdkCommand } from "../shellCommands/ocSdkCommands";
import { KubernetesContext } from "../kubernetes/kubernetesContext";
import { KubernetesObj } from "../kubernetes/kubernetes";
import { VSCodeCommands } from "../utilities/commandConstants";
import { getAnsibleGalaxySettings, AnsibleGalaxySettings } from "../utilities/util";

export class Session {
  public ocSdkInstalled: boolean = false;
  public loggedIntoOpenShift: boolean = false;
  public ocSdkOutdated: boolean = false;
  public skipSdkUpdated: boolean = false;
  public operationPending: boolean = false;
  public zosCloudBrokerInstalled: boolean = false;

  constructor(public readonly ocSdkCmd: OcSdkCommand) {}

  async update(skipRefresh?: boolean, skipOcSdkValidation?: boolean): Promise<boolean> {
    if (skipOcSdkValidation !== undefined && skipOcSdkValidation) {
      return Promise.all([this.validateOpenShiftAccess(), this.validateZosCloudBrokerInstallation()]).then(values => {
        const loggedIntoOpenShift = values[0];
        const zosCloudBrokerInstalled = values[1];
        return setContext(loggedIntoOpenShift, zosCloudBrokerInstalled, undefined, undefined, skipRefresh);
      });
    } else {
      return Promise.all([this.validateOcSDKInstallation(), this.validateOpenShiftAccess(), this.validateZosCloudBrokerInstallation(), this.determinateOcSdkIsOutdated()]).then(values => {
        const ocSdkInstalled = values[0];
        const loggedIntoOpenShift = values[1];
        const zosCloudBrokerInstalled = values[2];
        const ocsdkOutdated = values[3];
        return setContext(loggedIntoOpenShift, zosCloudBrokerInstalled, ocSdkInstalled, ocsdkOutdated, skipRefresh);
      });
    }
  }

  /**
   * Validates that the IBM Operator Collection SDK is installed
   * @returns - A promise containing a boolean, returning true if the IBM Operator Collection SDK is installed
   */
  async validateOcSDKInstallation(): Promise<boolean> {
    const ansibleGalaxyConnectivity = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyConnectivity) as boolean;
    if (!ansibleGalaxyConnectivity) {
      this.ocSdkInstalled = true;
      return true;
    }
    return this.ocSdkCmd
      .runCollectionVerifyCommand()
      .then(() => {
        this.ocSdkInstalled = true;
        return true;
      })
      .catch(() => {
        console.log("Install the IBM Operator Collection SDK use this extension");
        // vscode.window.showWarningMessage("Install the IBM Operator Collection SDK Ansible collection to use the IBM Operator Collection SDK extension");

        this.ocSdkInstalled = false;
        return false;
      });
  }

  /**
   * Determinate installed IBM Operator Collection SDK version
   * @returns - A promise containing a string, returning the installed IBM Operator Collection SDK version
   */
  async ocSdkVersion(): Promise<string | undefined> {
    const version = await this.ocSdkCmd.runOcSdkVersion();
    return version?.trim();
  }

  /**
   * Determinate if the installed IBM Operator Collection SDK can be updated to a newer version
   * @returns - A promise containing a boolean, returning true if the installed IBM Operator Collection SDK can be updated to a newer version
   */
  async determinateOcSdkIsOutdated(): Promise<boolean> {
    const ansibleGalaxyConnectivity = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyConnectivity) as boolean;
    if (!ansibleGalaxyConnectivity) {
      this.ocSdkOutdated = false;
      return false;
    }
    if (this.ocSdkInstalled && !this.skipSdkUpdated) {
      this.ocSdkOutdated = await this.ocSdkCmd.runDeterminateOcSdkIsOutdated();
      return this.ocSdkOutdated;
    } else {
      this.ocSdkOutdated = false;
      return false;
    }
  }

  /**
   * Set skip OCSDK update version flag
   * @returns - A promise containing a boolean, returning the skip Sdk Update version flag
   */
  async setSkipOcSdkVersionUpdateFlag(): Promise<boolean> {
    this.skipSdkUpdated = !this.skipSdkUpdated;
    return new Promise<boolean>((resolve: any) => resolve(this.skipSdkUpdated));
  }

  /**
   * Validates that the user is logged in to OpenShift
   * @returns - A promise containing a boolean, returning true if the user has access
   */
  async validateOpenShiftAccess(): Promise<boolean> {
    const k8s = new KubernetesContext();
    if (k8s?.coreV1Api) {
      return k8s.coreV1Api
        .readNamespace(k8s.namespace)
        .then(() => {
          this.loggedIntoOpenShift = true;
          return true;
        })
        .catch(e => {
          console.log("Log in to an OpenShift Cluster to use this extension: " + JSON.stringify(e));
          this.loggedIntoOpenShift = false;
          return false;
        });
    } else {
      this.loggedIntoOpenShift = false;
      return false;
    }
  }

  /**
   * Validates that the ZosCloudBroker instance is installed and running
   * @returns - A promise containing a boolean, returning true if the instance has been created
   */
  async validateZosCloudBrokerInstallation(): Promise<boolean> {
    const k8s = new KubernetesObj();
    return k8s
      .zosCloudBrokerInstanceCreated()
      .then(createdSuccessfully => {
        if (createdSuccessfully !== undefined) {
          this.zosCloudBrokerInstalled = createdSuccessfully;
          return createdSuccessfully;
        } else {
          return false;
        }
      })
      .catch(e => {
        console.log("Failure validating ZosCloudBroker install status: " + JSON.stringify(e));
        return false;
      });
  }
}

async function setContext(loggedIntoOpenShift: boolean, zosCloudBrokerInstalled: boolean, ocSdkInstalled?: boolean, ocSdkOutdated?: boolean, skipRefresh?: boolean): Promise<boolean> {
  if (ocSdkInstalled !== undefined && !ocSdkInstalled) {
    return vscode.commands.executeCommand("setContext", VSCodeCommands.sdkInstalled, ocSdkInstalled).then(() => {
      if (!skipRefresh) {
        vscode.commands.executeCommand(VSCodeCommands.refreshAll);
      }
      vscode.window.showWarningMessage("Unable to detect the Operator Collection SDK. Please reinstall.");
      return false;
    });
  }
  if (!loggedIntoOpenShift) {
    return vscode.commands.executeCommand("setContext", VSCodeCommands.loggedIn, loggedIntoOpenShift).then(() => {
      if (skipRefresh !== undefined && !skipRefresh) {
        vscode.commands.executeCommand(VSCodeCommands.refreshAll);
      }
      return false;
    });
  }

  if (!zosCloudBrokerInstalled) {
    return vscode.commands.executeCommand("setContext", VSCodeCommands.zosCloudBrokerInstalled, zosCloudBrokerInstalled).then(() => {
      if (skipRefresh !== undefined && !skipRefresh) {
        vscode.commands.executeCommand(VSCodeCommands.refreshAll);
      }
      return false;
    });
  }

  if (ocSdkOutdated !== undefined) {
    return vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion, ocSdkOutdated).then(() => {
      if (!skipRefresh) {
        vscode.commands.executeCommand(VSCodeCommands.refreshAll);
      }
      return !ocSdkOutdated;
    });
  }

  return true;
}
