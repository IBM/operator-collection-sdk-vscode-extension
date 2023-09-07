import * as vscode from 'vscode';
import * as path from "path";
import * as util from "../utilities/util";
import * as k8s from '@kubernetes/client-node';
import * as fs from "fs";
import { VSCodeCommands } from '../utilities/commandConstants';
import { OcCommand } from '../commands/ocCommand';

export class KubernetesContext {
    public coreV1Api: k8s.CoreV1Api | undefined = undefined;
    public customObjectsApi: k8s.CustomObjectsApi | undefined = undefined;
    public namespace: string = "";
    public openshiftServerURL: string | undefined = "";
    constructor(namespace?: string) {
        const kc = new k8s.KubeConfig();
        if (namespace === undefined) {
            if (fs.existsSync("/var/run/secrets/kubernetes.io/serviceaccount")) {
                kc.loadFromCluster();
                this.namespace = fs.readFileSync('/var/run/secrets/kubernetes.io/serviceaccount/namespace').toString();
            } else {
                kc.loadFromDefault();
                if (kc.currentContext) {
                    const currentContextObj = kc.getContextObject(kc.currentContext);
                    if (currentContextObj?.namespace) {
                        this.namespace = currentContextObj.namespace;
                    }
                }
            }
        } else {
            kc.loadFromDefault();
            this.namespace = namespace;
        }

        if (kc.currentContext) {
            this.openshiftServerURL = kc.getCurrentCluster()?.server;
            this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
            this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
        } else {
            // If kc is still empty, the Kube Config file is likely invalid
            vscode.window.showWarningMessage("Your KubeConfig file has not been properly configured.");

            // Prompt OC login
            const ocCmd = new OcCommand();
            this.attemptOCLogin(ocCmd).then((loggedIn) => {
                if (loggedIn) {
                    // oc login successful, kube config configured
                    kc.loadFromDefault();
                    vscode.window.showInformationMessage("KubeConfig context has been configured.");
                    this.openshiftServerURL = kc.getCurrentCluster()?.server;
                    this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
                    this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
                    vscode.commands.executeCommand(VSCodeCommands.refreshAll);
                }
            });
        }
    }

    /**
     * Executes the requested command
     * @param ocCmd - The oc command to be executed
     * @returns - A Promise containing a boolean signaling the success of the executed command
     */
    public async attemptOCLogin (ocCmd: OcCommand): Promise<Boolean> {
        return new Promise (async (resolve, reject) => {
            const args = await util.requestLogInInfo();
            if (args) {
                try {
                    const response = await ocCmd.runOcLoginCommand(args);
                    vscode.window.showInformationMessage(response);
                    vscode.window.showInformationMessage("Successfully logged in to OpenShift cluster.");
                    vscode.commands.executeCommand(VSCodeCommands.refreshAll);
                    resolve(true);
                } catch (error) {
                    vscode.window.showErrorMessage("Failure logging in to OpenShift cluster");
                    reject(false);
                }
            } else {
                reject(false);
            }
        });
    }
}