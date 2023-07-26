import * as vscode from 'vscode';
import {OcSdkCommand} from "../shellCommands/ocSdkCommands";
import {KubernetesObj} from "../kubernetes/kubernetes";

export class Session {
    private ocSdkCmd: OcSdkCommand;
    private k8s: KubernetesObj;
    public ocSdkInstalled: boolean = false;
    public loggedIntoOpenShift: boolean = false;
    
    constructor(){
        this.ocSdkCmd = new OcSdkCommand();
        this.k8s = new KubernetesObj();
    };

    /**
     * Validates that the IBM Operator Collection SDK is installed
     * @returns - A promise containing a boolean, returning true if the IBM Operator Collection SDK is installed
     */
    async validateOcSDKInstallation(): Promise<boolean> {
        try {
            await this.ocSdkCmd.runCollectionVerifyCommand(true);
            this.ocSdkInstalled = true;
            return true;
        } catch(e) {
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
        return this.k8s.coreV1Api.listNamespacedPod(this.k8s.namespace).then(() => {
            this.loggedIntoOpenShift = true;
            return true;
        }).catch(() => {
            vscode.window.showWarningMessage("Log in to an OpenShift Cluster to use this extension");
            this.loggedIntoOpenShift = false;
            return false;
        });
    }
}