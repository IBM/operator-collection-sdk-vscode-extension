/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import {OcSdkCommand} from "../shellCommands/ocSdkCommands";
import {KubernetesContext} from "../kubernetes/kubernetesContext";

export class Session {
    public ocSdkInstalled: boolean = false;
    public loggedIntoOpenShift: boolean = false;
    
    constructor(public readonly ocSdkCmd: OcSdkCommand){};

    /**
     * Validates that the IBM Operator Collection SDK is installed
     * @returns - A promise containing a boolean, returning true if the IBM Operator Collection SDK is installed
     */
    async validateOcSDKInstallation(): Promise<boolean> {
        try {
            await this.ocSdkCmd.runCollectionVerifyCommand();
            this.ocSdkInstalled = true;
            return true;
        } catch(e) {
            console.log("Install the IBM Operator Collection SDK use this extension");
            vscode.window.showWarningMessage("Install the IBM Operator Collection SDK use this extension");
            this.ocSdkInstalled = false;
            return false;
        }
    }

    /**
     * Validates that the user is logged in to OpenShift
     * @returns - A promise containing a boolean, returning true if the user has access
     */
    async validateOpenShiftAccess(): Promise<boolean> {
        const k8s = new KubernetesContext();

        if (k8s?.coreV1Api) {
            return k8s.coreV1Api.listNamespacedPod(k8s.namespace).then(() => {
                this.loggedIntoOpenShift = true;
                return true;
            }).catch((e) => {
                console.log("Log in to an OpenShift Cluster to use this extension: " + JSON.stringify(e));
                vscode.window.showWarningMessage("Log in to an OpenShift Cluster to use this extension");
                this.loggedIntoOpenShift = false;
                return false;
            });
        } else {
            this.loggedIntoOpenShift = false;
            return false;
        }
    }
}