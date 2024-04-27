/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import { OcSdkCommand } from "../shellCommands/ocSdkCommands";
import { KubernetesObj } from "../kubernetes/kubernetes";
import { VSCodeCommands } from "../utilities/commandConstants";
import { getAnsibleGalaxySettings, AnsibleGalaxySettings } from "../utilities/util";

export class Session {
  public ocSdkInstalled: boolean = false;
  public loggedIntoOpenShift: boolean = false;
  public validNamespace: boolean = false;
  public ocSdkOutdated: boolean = false;
  public skipSdkUpdated: boolean = false;
  public skipOCinit: boolean = false;
  public operationPending: boolean = false;
  public zosCloudBrokerInstalled: boolean = false;

  constructor(public readonly ocSdkCmd: OcSdkCommand) {}

  async update(skipRefresh?: boolean, skipOcSdkValidation?: boolean): Promise<boolean> {
    if (skipOcSdkValidation !== undefined && skipOcSdkValidation) {
      return Promise.all([this.validateOpenShiftAccess(), this.validateZosCloudBrokerInstallation(), this.validateNamespaceExists()]).then(() => {
        return setContext(this.loggedIntoOpenShift, this.zosCloudBrokerInstalled, undefined, undefined, skipRefresh, this.validNamespace);
      });
    } else {
      return Promise.all([this.validateOcSDKInstallation(), this.validateOpenShiftAccess(), this.validateZosCloudBrokerInstallation(), this.determinateOcSdkIsOutdated(), this.validateNamespaceExists()]).then(() => {
        return setContext(this.loggedIntoOpenShift, this.zosCloudBrokerInstalled, this.ocSdkInstalled, this.ocSdkOutdated, skipRefresh, this.validNamespace);
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
      try {
        this.ocSdkOutdated = await this.ocSdkCmd.runDeterminateOcSdkIsOutdated();
        return this.ocSdkOutdated;
      } catch (e) {
        console.log(e);
        this.ocSdkOutdated = false;
        return false;
      }
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
   * Set skip OC init flag
   * @returns - A promise containing a boolean, returning the skip the oc init
   */
  async setSkipOCinitFlag(): Promise<boolean> {
    this.skipOCinit = !this.skipOCinit;
    return new Promise<boolean>((resolve: any) => resolve(this.skipOCinit));
  }

  /**
   * Validates that the user is logged in to OpenShift
   * @returns - A promise containing a boolean, returning true if the user has access
   */
  async validateOpenShiftAccess(): Promise<boolean> {
    const k8s = new KubernetesObj();

    const result = k8s
      .getNamespaceList()
      .then(list => {
        if (list !== undefined) {
          this.loggedIntoOpenShift = true;
          return true;
        }
        this.loggedIntoOpenShift = false;
        return false;
      })
      .catch(e => {
        vscode.window.showInformationMessage("Log in to an OpenShift Cluster to use this extension: " + JSON.stringify(e));
        this.loggedIntoOpenShift = false;
        return false;
      });

    // Cancel request after 5 seconds without a response from the getNamespaceList request.
    // This usually implies a connectivity issue with OpenShift, which could take a minute or more
    // before receiving the timeout response.
    let timeout: NodeJS.Timeout | undefined = undefined;
    const timeoutPromise: Promise<boolean> = new Promise(resolve => {
      timeout = setTimeout(() => {
        vscode.window.showWarningMessage("Connection timed out... Please validate the connectivity to OpenShift");
        resolve(false);
      }, 5000);
    });

    const done = Promise.race([result, timeoutPromise])
      .then(value => {
        this.loggedIntoOpenShift = Boolean(value);
        return value;
      })
      .catch(e => {
        this.loggedIntoOpenShift = false;
        return false;
      })
      .finally(() => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
    return done;
  }

  /**
   * Validates the namespace exists
   * @returns - A promise containing a boolean, returning true if the namespace exist
   */
  async validateNamespaceExists(): Promise<boolean> {
    const k8s = new KubernetesObj();
    return k8s
      .validateNamespaceExists()
      .then(exists => {
        if (exists !== undefined && exists) {
          this.validNamespace = true;
          return true;
        }
        this.validNamespace = false;
        return false;
      })
      .catch(e => {
        console.log("Namespace " + k8s.namespace + " Does not exist." + JSON.stringify(e));
        this.validNamespace = false;
        return false;
      });
  }

  /**
   * Validates that the ZosCloudBroker instance is installed and running
   * @returns - A promise containing a boolean, returning true if the instance has been created
   */
  async validateZosCloudBrokerInstallation(): Promise<boolean> {
    const k8s = new KubernetesObj();
    if (this.loggedIntoOpenShift === false) {
      return false;
    }
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

async function setContext(loggedIntoOpenShift: boolean, zosCloudBrokerInstalled: boolean, ocSdkInstalled?: boolean, ocSdkOutdated?: boolean, skipRefresh?: boolean, validNamespace?: boolean): Promise<boolean> {
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

  if (!zosCloudBrokerInstalled || !validNamespace) {
    return Promise.all([vscode.commands.executeCommand("setContext", VSCodeCommands.loggedIn, loggedIntoOpenShift), vscode.commands.executeCommand("setContext", VSCodeCommands.zosCloudBrokerInstalled, zosCloudBrokerInstalled), vscode.commands.executeCommand("setContext", VSCodeCommands.validNamespace, validNamespace)]).then(() => {
      if (skipRefresh !== undefined && !skipRefresh) {
        vscode.commands.executeCommand(VSCodeCommands.refreshAll);
      }
      return false;
    });
  }

  if (ocSdkOutdated !== undefined) {
    return vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion, ocSdkOutdated, vscode.commands.executeCommand("setContext", VSCodeCommands.zosCloudBrokerInstalled, zosCloudBrokerInstalled)).then(() => {
      if (!skipRefresh) {
        vscode.commands.executeCommand(VSCodeCommands.refreshAll);
      }
      return !ocSdkOutdated;
    });
  }

  return true;
}
