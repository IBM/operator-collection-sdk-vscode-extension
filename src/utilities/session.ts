/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { OcSdkCommand } from "../shellCommands/ocSdkCommands";
import { KubernetesContext } from "../kubernetes/kubernetesContext";
import { VSCodeCommands } from "../utilities/commandConstants";
import {
  getAnsibleGalaxySettings,
  AnsibleGalaxySettings,
} from "../utilities/util";

export class Session {
  public ocSdkInstalled: boolean = false;
  public loggedIntoOpenShift: boolean = false;
  public ocSdkOutdated: boolean = false;
  public skipSdkUpdated: boolean = false;
  public operationPending: boolean = false;

  constructor(public readonly ocSdkCmd: OcSdkCommand) {}

  async update(skipRefresh?: boolean): Promise<boolean> {
    const ocSdkInstalled = await this.validateOcSDKInstallation();
    const loggedIntoOpenShift = await this.validateOpenShiftAccess();

    if (!ocSdkInstalled) {
      return vscode.commands.executeCommand(
        "setContext",
        VSCodeCommands.sdkInstalled,
        ocSdkInstalled,
      ).then(() => {
        if (!skipRefresh) {
          vscode.commands.executeCommand(VSCodeCommands.refreshAll);
        }
        vscode.window.showWarningMessage("Unable to detect the Operator Collection SDK. Please reinstall.");
        return false;
      });
    }
    if (!loggedIntoOpenShift) {
      return vscode.commands.executeCommand(
        "setContext",
        VSCodeCommands.loggedIn,
        loggedIntoOpenShift,
      ).then(() => {
        if (!skipRefresh) {
          vscode.commands.executeCommand(VSCodeCommands.refreshAll);
        }
        vscode.window.showWarningMessage("Unable to connect to an OpenShift cluster. Please log in again.");
        return false;
      });
    }
    return true;
  }

  /**
   * Validates that the IBM Operator Collection SDK is installed
   * @returns - A promise containing a boolean, returning true if the IBM Operator Collection SDK is installed
   */
  async validateOcSDKInstallation(): Promise<boolean> {
    const ansibleGalaxyConnectivity = getAnsibleGalaxySettings(
      AnsibleGalaxySettings.ansibleGalaxyConnectivity,
    ) as boolean;
    if (!ansibleGalaxyConnectivity) {
      this.ocSdkInstalled = true;
      return true;
    }
    try {
      await this.ocSdkCmd.runCollectionVerifyCommand();
      this.ocSdkInstalled = true;
      return true;
    } catch (e) {
      console.log("Install the IBM Operator Collection SDK use this extension");
      // vscode.window.showWarningMessage("Install the IBM Operator Collection SDK Ansible collection to use the IBM Operator Collection SDK extension");

      this.ocSdkInstalled = false;
      return false;
    }
  }

  /**
   * Determinate installed IBM Operator Collection SDK version
   * @returns - A promise containing a string, returning the installed IBM Operator Collection SDK version
   */
  async ocSdkVersion(): Promise<string> {
    const version = await this.ocSdkCmd.runOcSdkVersion();
    return version;
  }

  /**
   * Determinate if the installed IBM Operator Collection SDK can be updated to a newer version
   * @returns - A promise containing a boolean, returning true if the installed IBM Operator Collection SDK can be updated to a newer version
   */
  async determinateOcSdkIsOutdated(): Promise<boolean> {
    const ansibleGalaxyConnectivity = getAnsibleGalaxySettings(
      AnsibleGalaxySettings.ansibleGalaxyConnectivity,
    ) as boolean;
    if (!ansibleGalaxyConnectivity) {
      this.ocSdkOutdated = false;
      return false;
    }
    if (this.ocSdkInstalled && !this.skipSdkUpdated) {
      this.ocSdkOutdated = await this.ocSdkCmd.runDeterminateOcSdkIsOutdated();
      return this.ocSdkOutdated;
    } else {
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
        .listNamespacedPod(k8s.namespace)
        .then(() => {
          this.loggedIntoOpenShift = true;
          return true;
        })
        .catch((e) => {
          console.log(
            "Log in to an OpenShift Cluster to use this extension: " +
              JSON.stringify(e),
          );
          this.loggedIntoOpenShift = false;
          return false;
        });
    } else {
      this.loggedIntoOpenShift = false;
      return false;
    }
  }
}
