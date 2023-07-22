import * as k8s from '@kubernetes/client-node';
import * as fs from "fs";
import * as path from 'path';
import {OcCpCommand} from "../commands/ocCpCommand";

export interface ObjectList {
    apiVersion: string;
    items: Array<ObjectInstance>;
}

export interface ObjectInstance {
    apiVersion: string;
    kind: string;
    metadata: ObjectMetadata;
    status: ObjectStatus;
}

export interface ObjectMetadata {
    name: string;
    namespace: string;
}

export interface ObjectStatus {
    phase: string;
}

interface RouteObject {
    metadata: ObjectMetadata;
    spec: RouteObjectSpec;
}

interface RouteObjectSpec {
    host: string;
}
export class KubernetesObj {
    private coreV1Api: k8s.CoreV1Api;
    private customObjectsApi: k8s.CustomObjectsApi;
    public namespace: string = "";
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
        this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
        this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    }

    /**
     * Returns a list of pods for the corresponding operator
     * @param operatorName - operator name
     * @returns - Promise containing a list of Pod objects
     */
    public async getOperatorPods(operatorName: string): Promise<k8s.V1Pod[]> {
        const podList: Array<string> = [];
        const labelSelector = `operator-name=${operatorName}`;
        const pods = await this.coreV1Api.listNamespacedPod(
            this.namespace,
            undefined, // pretty
            undefined, // allowWatchBookmarks
            undefined, // _continue
            undefined, // fieldSelector
            labelSelector
        );
        
        return pods.body.items;
    }

     /**
     * Returns a list of containers in the corresponding operator pod
     * @param operatorName - operator name
     * @returns - Promise containing a list of Pod objects
     */
     public async getOperatorContainers(operatorName: string): Promise<k8s.V1Container[]> {
        const containers: Array<k8s.V1Container> = [];
        const pods = await this.getOperatorPods(operatorName);
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

    public async downloadContainerLogs(podName: string, containerName: string, workspacePath: string): Promise<string | undefined> {
        const logs = await this.coreV1Api.readNamespacedPodLog(podName, this.namespace, containerName);
        const logsPath = path.join(workspacePath, `${podName}-${containerName}.log`);
        try {
            fs.writeFileSync(logsPath, Buffer.from(logs.body));
        } catch (err) {
            console.error("Failure downloading container logs");
            return undefined;
        }
        return logsPath;
    }

    public async downloadVerboseContainerLogs(podName: string, containerName: string, workspacePath: string, apiVersion: string, kind: string, instanceName: string): Promise<string | undefined> {
        const logsPath = path.join(workspacePath, `${podName}-${containerName}-verbose.log`);
        const ocCmd = new OcCpCommand();
        await ocCmd.runOcCpCommand(podName, this.namespace, containerName, logsPath, apiVersion, kind, instanceName);
        return logsPath;
    }

    public async getCustomResources(apiVersion: string, pluralKind: string): Promise<ObjectList> {
        let customResources = await this.customObjectsApi.listNamespacedCustomObject(
            "suboperator.zoscb.ibm.com",
            apiVersion,
            this.namespace,
            pluralKind.toLowerCase()
        );
        let customResourcesString = JSON.stringify(customResources.body);
        let customResourcesList: ObjectList = JSON.parse(customResourcesString);
        return customResourcesList;
    }

    public async getSubOperatorConfigs(operatorName: string): Promise<ObjectList> {
        return await this.getBrokerObjList(operatorName, "suboperatorconfigs");
    }

    public async getZosEndpoints(operatorName: string): Promise<ObjectList> {
        // only retrieve endpoints mapped to SubOperatorConfig
        return await this.getBrokerObjList(operatorName, "zosendpoints");
    }

    public async getOperatorCollections(operatorName: string): Promise<ObjectList> {
        return await this.getBrokerObjList(operatorName, "operatorcollections");
    }

    private async getBrokerObjList(operatorName: string, objPlural: string): Promise<ObjectList> {
        let objsString: string = "";
        if (objPlural !== "zosendpoints") {
            const labelSelector = `operator-name=${operatorName}`;
            let objs = await this.customObjectsApi.listNamespacedCustomObject(
                "zoscb.ibm.com",
                "v2beta2",
                this.namespace,
                objPlural,
                undefined, // pretty
                undefined, // allowWatchBookmarks
                undefined, // continue
                undefined, // fieldSelector
                labelSelector
            );
            objsString = JSON.stringify(objs.body);
        } else {
            let objs = await this.customObjectsApi.listNamespacedCustomObject(
                "zoscb.ibm.com",
                "v2beta2",
                this.namespace,
                objPlural
            );
            objsString = JSON.stringify(objs.body);
        }
        
        let objsList: ObjectList = JSON.parse(objsString);
        return objsList;
    }

    public async listCustomResouceInstanceNames(apiVersion: string, kind: string): Promise<string[]> {
        let crInstanceNames: Array<string> = [];
        const crInstances = await this.customObjectsApi.listNamespacedCustomObject(
            "suboperator.zoscb.ibm.com",
            apiVersion,
            this.namespace,
            `${kind.toLowerCase()}s`
        );
        let crInstacesString = JSON.stringify(crInstances.body);
        let crInstanceList: ObjectList = JSON.parse(crInstacesString);
        
        for (let items of crInstanceList.items) {
            crInstanceNames.push(items.metadata.name);
        }
        return crInstanceNames;
    }

    public async getOpenshifConsoleUrl(): Promise<string> {
        let consoleRoute = await this.customObjectsApi.getNamespacedCustomObject("route.openshift.io", "v1", "openshift-console", "routes", "console");
        let consoleRouteString = JSON.stringify(consoleRoute.body);
        let routeObj: RouteObject = JSON.parse(consoleRouteString);
        return routeObj.spec.host;
    }
}
// https://console-openshift-console.zoscb-pentest-42d4bdeacfebc108744a5d18dc2f0439-0000.us-east.containers.appdomain.cloud/k8s/ns/latrell-test/clusterserviceversions/ibm-zoscb.v2.2.1/zoscb.ibm.com~v2beta2~ZosEndpoint/ibmcloud-vm/yaml
// https://console-openshift-console.zoscb-pentest-42d4bdeacfebc108744a5d18dc2f0439-0000.us-east.containers.appdomain.cloud/k8s/ns/latrell-test/zoscb.ibm.com~v2beta2~ZosEndpoint/ibmcloud-vm/yaml