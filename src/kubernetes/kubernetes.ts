/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import * as k8s from '@kubernetes/client-node';
import * as fs from "fs";
import * as path from 'path';
import * as util from '../utilities/util';
import {OcCommand} from "../shellCommands/ocCommand";

export interface ObjectList {
    apiVersion: string;
    items: Array<ObjectInstance>;
}

export interface ObjectInstance {
    apiVersion: string;
    kind: string;
    metadata: ObjectMetadata;
    status?: ObjectStatus;
}

export interface ObjectMetadata {
    name: string;
    namespace: string;
    deletionTimestamp?: string;
}

export interface ObjectStatus {
    phase?: string;
}

interface RouteObject {
    metadata: ObjectMetadata;
    spec: RouteObjectSpec;
}

interface RouteObjectSpec {
    host: string;
}
export class KubernetesObj {
    public coreV1Api: k8s.CoreV1Api;
    public customObjectsApi: k8s.CustomObjectsApi;
    public namespace: string = "";
    public openshiftServerURL: string | undefined  = "";
    constructor() {
        const kc = new k8s.KubeConfig();
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

        this.openshiftServerURL = kc.getCurrentCluster()?.server;
        this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
        this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    }

    /**
     * Validate if user is logged into an OCP Cluster
     * @returns - A promise containing a boolean
     */
    public async isUserLoggedIntoOCP(): Promise<boolean> {
        return this.coreV1Api.listNamespacedPod(this.namespace).then(() => {
            return true;
        }).catch(() => {
            vscode.window.showWarningMessage("Log in to an OpenShift Cluster to use this extension");
            return false;
        });
    }

    /**
     * Returns a list of pods for the corresponding operator
     * @param operatorName - operator name
     * @returns - Promise containing a list of Pod objects
     */
    public async getOperatorPods(operatorName: string): Promise<k8s.V1Pod[] | undefined> {
        const podList: Array<string> = [];
        const labelSelector = `operator-name=${operatorName}`;
        return this.coreV1Api.listNamespacedPod(
            this.namespace,
            undefined, // pretty
            undefined, // allowWatchBookmarks
            undefined, // _continue
            undefined, // fieldSelector
            labelSelector
        ).then((res) => {
            return res.body.items;
        }).catch((e) => {
            const msg = `Failure retrieving Pods in namespace. ${e.response.statusMessage}`;
            console.error(msg);
            vscode.window.showErrorMessage(msg);
            return undefined;
        });
    }

     /**
     * Returns a list of containers in the corresponding operator pod
     * @param operatorName - operator name
     * @returns - Promise containing a list of Pod objects
     */
     public async getOperatorContainers(operatorName: string): Promise<k8s.V1Container[] | undefined> {
        const containers: Array<k8s.V1Container> = [];
        const pods = await this.getOperatorPods(operatorName);
        if (pods) {
            for (const pod of pods) {
                if (pod.spec?.initContainers) {
                    for (const initContainer of pod.spec?.initContainers) {
                        containers.push(initContainer);
                    }
                }
                if (pod.spec?.containers) {
                    for (const container of pod.spec?.containers) {
                        containers.push(container);
                    }
                }
            }
            return containers;
        } else {
            return undefined;
        }
    }

    /**
     * Returns a list of container statuses in the corresponding operator pod
     * @param operatorName - operator name
     * @returns - Promise containing a list of Pod objects
     */
    public async getOperatorContainerStatuses(operatorName: string, pod: k8s.V1Pod): Promise<k8s.V1ContainerStatus[]> {
        const containerStatuses: Array<k8s.V1ContainerStatus> = [];
        if (pod.status?.initContainerStatuses) {
            for (const initContainerStatus of pod.status?.initContainerStatuses) {
                // if deletionTimestamp is set then this implies that the pod is temination
                // which we should then set the status to "waiting".
                if (pod.metadata?.deletionTimestamp && initContainerStatus.state) {
                    this.setTerminatingStatus(initContainerStatus);
                }
                containerStatuses.push(initContainerStatus);
            }
        }
        if (pod.status?.containerStatuses) {
            for (let containerStatus of pod.status?.containerStatuses) {
                // if deletionTimestamp is set then this implies that the pod is temination
                // which we should then set the status to "waiting".
                if (pod.metadata?.deletionTimestamp && containerStatus.state) {
                    this.setTerminatingStatus(containerStatus);
                }
                containerStatuses.push(containerStatus);
            }
        }
        return containerStatuses;
    }

    private setTerminatingStatus(containerStatus: k8s.V1ContainerStatus): void {
        if (containerStatus.state) {
            containerStatus.state.running = undefined;
            containerStatus.state.terminated = undefined;
            containerStatus.state.waiting = new k8s.V1ContainerState().waiting;
        }
    }

    /**
     * Download the container logs
     * @param podName - The pod name where the container resides
     * @param containerName - The container name within the pod
     * @param workspacePath - The current workspace path
     * @returns - A promise containing the path to the container log
     */
    public async downloadContainerLogs(podName: string, containerName: string, workspacePath: string): Promise<string | undefined> {
        return this.coreV1Api.readNamespacedPodLog(podName, this.namespace, containerName).then((res) => {
            if (! fs.existsSync(path.join(workspacePath, ".openshiftLogs"))) {
                fs.mkdirSync(path.join(workspacePath, ".openshiftLogs"));
            }
            const logsPath = path.join(workspacePath, ".openshiftLogs", `${podName}-${containerName}.log`);
            try {
                fs.writeFileSync(logsPath, Buffer.from(res.body));
            } catch (e) {
                const msg = `Failure downloading container logs. ${e}`;
                console.error(msg);
                vscode.window.showErrorMessage(msg);
                return undefined;
            }
            return logsPath;
        }).catch((e) => {
            const msg = `Failure retrieving Pod logs. ${e.response.statusMessage}`;
            console.error(msg);
            vscode.window.showErrorMessage(msg);
            return undefined;
        });
    }

    /**
     * Download the verbose container logs
     * @param podName - The pod name where the container resides
     * @param containerName - The container name within the pod
     * @param workspacePath - The current workspace path
     * @param apiVersion - The resource API version
     * @param kind - The resource Kind
     * @param instanceName - The resource instance name
     * @returns - A promise containing the path to the container log
     */
    public async downloadVerboseContainerLogs(podName: string, containerName: string, workspacePath: string, apiVersion: string, kind: string, instanceName: string): Promise<string | undefined> {
        if (! fs.existsSync(path.join(workspacePath, ".openshiftLogs"))) {
            fs.mkdirSync(path.join(workspacePath, ".openshiftLogs"));
        }
        const logsPath = path.join(workspacePath, ".openshiftLogs", `${podName}-${containerName}-verbose.log`);
        const ocCmd = new OcCommand();
        return ocCmd.runOcCpCommand(podName, this.namespace, containerName, logsPath, apiVersion, kind, instanceName).then((res) => {
            return logsPath;
        }).catch((e) => {
            const msg = `Failure running the "oc cp" command. ${e.response.statusMessage}`;
            console.error(msg);
            vscode.window.showErrorMessage(msg);
            return undefined;
        });
    }

    /**
     * Retrieve the Custom Resource List
     * @param apiVersion - The custom resource API version
     * @param kind - The custom resource Kind
     * @returns - A promise containing a list of Custom Resources found in the namespace
     */
    public async getCustomResources(apiVersion: string, kind: string): Promise<ObjectList | undefined> {
        return this.customObjectsApi.listNamespacedCustomObject(
            "suboperator.zoscb.ibm.com",
            apiVersion,
            this.namespace,
            `${kind.toLowerCase()}s`
        ).then((res) => {
            let customResourcesString = JSON.stringify(res.body);
            let customResourcesList: ObjectList = JSON.parse(customResourcesString);
            return customResourcesList;
        }).catch((e) => {
            if (e.response.statusCode && e.response.statusCode === 404) { // 404s are fine since there a change that the CRD or API Version hasn't yet been created on the cluster
                return undefined;
            } else {
                const msg = `Failure retrieving Custom Resource list. ${e.response.statusMessage}`;
                console.error(msg);
                vscode.window.showErrorMessage(msg);
                return undefined;
            }
        });
    }

    /**
     * Delete the Custom Resource List
     * @param apiVersion - The custom resource API version
     * @param kind - The custom resource Kind
     * @returns - A promise containing a list of Custom Resources found in the namespace
     */
    public async deleteCustomResource(name: string, apiVersion: string, kind: string): Promise<boolean> {
        return this.customObjectsApi.deleteNamespacedCustomObject(
            "suboperator.zoscb.ibm.com",
            apiVersion,
            this.namespace,
            `${kind.toLowerCase()}s`,
            name
        ).then(() => {
            return true;
        }).catch((e) => {
            if (e.response.statusCode && e.response.statusCode === 404) { // 404s are fine since there a change that the CRD or API Version hasn't yet been created on the cluster
                return false;
            } else {
                const msg = `Failure deleting Custom Resource object. ${e.response.statusMessage}`;
                console.error(msg);
                vscode.window.showErrorMessage(msg);
                return false;
            }
        });
    }

    /**
     * Retrieve the SubOpeatorConfigs in the namespce with the current operator-name label
     * @param operatorName - The name of the operator created by the SubOperatorConfig
     * @returns - A promise containing a list of SubOperatorConfigs found in the namespace
     */
    public async getSubOperatorConfigs(operatorName: string): Promise<ObjectList | undefined> {
        return await this.getBrokerObjList("suboperatorconfigs", operatorName);
    }

    /**
     * Retrieve the ZosEndpoints in the namespce
     * @returns - A promise containing a list of ZosEndpoints found in the namespace
     */
    public async getZosEndpoints(): Promise<ObjectList | undefined> {
        // only retrieve endpoints mapped to SubOperatorConfig
        return await this.getBrokerObjList("zosendpoints");
    }

    /**
     * Retrieve the OperatorCollection in the namespce
     * @param operatorName - The name of the operator create by the OperatorCollection
     * @returns 
     */
    public async getOperatorCollections(operatorName: string): Promise<ObjectList | undefined> {
        return await this.getBrokerObjList("operatorcollections", operatorName);
    }

    private async getBrokerObjList(objPlural: string, operatorName?: string): Promise<ObjectList | undefined> {
        let objsString: string = "";
        if (objPlural !== "zosendpoints" && operatorName) {
            const labelSelector = `operator-name=${operatorName}`;
            return this.customObjectsApi.listNamespacedCustomObject(
                util.zosCloudBrokerGroup,
                util.subOperatorConfigApiVersion,
                this.namespace,
                objPlural,
                undefined, // pretty
                undefined, // allowWatchBookmarks
                undefined, // continue
                undefined, // fieldSelector
                labelSelector
            ).then((res) => {
                objsString = JSON.stringify(res.body);
                let objsList: ObjectList = JSON.parse(objsString);
                return objsList;
            }).catch((e) => {
                if (e.response.statusCode && e.response.statusCode === 404) { // 404s are fine since there a change that the CRD or API Version hasn't yet been created on the cluster
                    return undefined;
                } else {
                    const msg = `Failure retrieving Broker object list. ${e.response.statusMessage}`;
                    console.error(msg);
                    vscode.window.showErrorMessage(msg);
                    return undefined;
                }
            });
            
        } else {
            return this.customObjectsApi.listNamespacedCustomObject(
                util.zosCloudBrokerGroup,
                util.zosEndpointApiVersion,
                this.namespace,
                objPlural
            ).then((res) => {
                objsString = JSON.stringify(res.body);
                let objsList: ObjectList = JSON.parse(objsString);
                return objsList;
            }).catch((e) => {
                if (e.response.statusCode && e.response.statusCode === 404) { // 404s are fine since there a change that the CRD or API Version hasn't yet been created on the cluster
                    return undefined;
                } else {
                    const msg = `Failure retrieving Broker object list. ${e.response.statusMessage}`;
                    console.error(msg);
                    vscode.window.showErrorMessage(msg);
                    return undefined;
                }
            });  
        }
    }

    /**
     * Retrieve a list of Custom Resource instance names in the current namespace
     * @param apiVersion - The custom resource API version
     * @param kind - The custom resource Kind
     * @returns - A promise containing a list of Custom Resource instance names
     */
    public async listCustomResouceInstanceNames(apiVersion: string, kind: string): Promise<string[] | undefined> {
        let crInstanceNames: Array<string> = [];
        return this.customObjectsApi.listNamespacedCustomObject(
            "suboperator.zoscb.ibm.com",
            apiVersion,
            this.namespace,
            `${kind.toLowerCase()}s`
        ).then((res) => {
            let crInstacesString = JSON.stringify(res.body);
            let crInstanceList: ObjectList = JSON.parse(crInstacesString);
            
            if (crInstanceList.items.length  === 0) {
                vscode.window.showInformationMessage(`Verbose logs unavailable: No instances exists for the ${kind} kind`);
                return undefined;
            }
            
            for (let items of crInstanceList.items) {
                crInstanceNames.push(items.metadata.name);
            }
            return crInstanceNames;
        }).catch((e) => {
            if (e.response.statusCode && e.response.statusCode === 404) { 
                return undefined;
            } else {
                const msg = `Failure retrieving Custom Resource instance names. ${e.response.statusMessage}`;
                console.error(msg);
                vscode.window.showErrorMessage(msg);
                return undefined;
            }
        });
    }

    /**
     * Retrieves the OpenShift dashboard URL
     * @returns - A promise containing the OpenShift dashboard URL
     */
    public async getOpenshifConsoleUrl(): Promise<string> {
        let consoleRoute = await this.customObjectsApi.getNamespacedCustomObject("route.openshift.io", "v1", "openshift-console", "routes", "console");
        let consoleRouteString = JSON.stringify(consoleRoute.body);
        let routeObj: RouteObject = JSON.parse(consoleRouteString);
        return routeObj.spec.host;
    }

    private async getZosCloudBrokerCsvName(): Promise<string | undefined> {
        const labelSelector = `operators.coreos.com/ibm-zoscb.${this.namespace}=`;
        return this.customObjectsApi.listNamespacedCustomObject(
            util.clusterServiceVersionGroup,
            util.clusterServiceVersionApiVersion,
            this.namespace,
            "clusterserviceversions",
            undefined, // pretty
            undefined, // allowWatchBookmarks
            undefined, // continue
            undefined, // fieldSelector
            labelSelector,
        ).then((res) => {
            let csvInstacesString = JSON.stringify(res.body);
            let csvInstanceList: ObjectList = JSON.parse(csvInstacesString);
            if (csvInstanceList.items.length > 0) {
                return csvInstanceList.items[0].metadata.name;
            } else {
                return undefined;
            }
        }).catch((e) => {
            const msg: any = `Failure retrieving ClusterServiceVersion. ${e}`;
            console.error(msg);
            vscode.window.showErrorMessage(msg.toString());
            return undefined;
        });
        
    }

    private async isCustomResourceOperatorInstalled(csvName: string): Promise<boolean | undefined> {
        return this. customObjectsApi.getNamespacedCustomObject(
            util.clusterServiceVersionGroup,
            util.clusterServiceVersionApiVersion,
            this.namespace,
            "clusterserviceversions",
            csvName
        ).then((res) => {
            if (res.response.statusCode && res.response.statusCode === 200) {
                return true;
            }
        }).catch(() => {
            return false;
        });
    }

    public async getResourceUrl(kind: string, group: string, version: string, name: string, operatorCsvName?: string): Promise<string> {
        let consoleUrl = await this.getOpenshifConsoleUrl();
        if (kind === util.ZosCloudBrokerKinds.zosEndpoint || kind === util.ZosCloudBrokerKinds.subOperatorConfig || kind === util.ZosCloudBrokerKinds.operatorCollection) {
            const zosCloudBrokerCsvName = await this.getZosCloudBrokerCsvName();
            if (zosCloudBrokerCsvName) {
                return `https://${consoleUrl}/k8s/ns/${this.namespace}/clusterserviceversions/${zosCloudBrokerCsvName}/${group}~${version}~${kind}/${name}`;
            } else {
                return `https://${consoleUrl}/k8s/ns/${this.namespace}/${group}~${version}~${kind}/${name}/yaml`;
            }
        } else {
            if (operatorCsvName) {
                const customResourceCsvInstalled = await this.isCustomResourceOperatorInstalled(operatorCsvName);
                if (customResourceCsvInstalled) {
                    return `https://${consoleUrl}/k8s/ns/${this.namespace}/clusterserviceversions/${operatorCsvName}/${group}~${version}~${kind}/${name}`;
                } else {
                    return `https://${consoleUrl}/k8s/ns/${this.namespace}/${group}~${version}~${kind}/${name}/yaml`; 
                }
            } else {
                return `https://${consoleUrl}/k8s/ns/${this.namespace}/${group}~${version}~${kind}/${name}/yaml`; 
            }
        }
    }

    /**
     * Returns a list of namespaces on the OpenShift cluster
     * @returns - A promise containing a list of Namespace names
     */
    public async getNamespaceList(): Promise<string[] | undefined> {
        const namespaceList: Array<string> = [];
        return this.coreV1Api.listNamespace().then((res) => {
            let namespacesString = JSON.stringify(res.body);
            let namespacesbjectList: ObjectList = JSON.parse(namespacesString);
            for (const namespaces of namespacesbjectList.items) {
                namespaceList.push(namespaces.metadata.name);
            }
            return namespaceList;
        }).catch((e) => {
            const msg = `Failure retrieving Namespace list: ${e.response.statusMessage}`;
            console.error(msg);
            vscode.window.showErrorMessage(msg);
            return undefined;
        });
    }
}