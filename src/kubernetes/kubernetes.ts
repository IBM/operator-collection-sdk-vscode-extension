import * as k8s from '@kubernetes/client-node';
import * as fs from "fs";
import * as path from 'path';

export class KubernetesObj {
    private coreV1Api: k8s.CoreV1Api;
    private namespace: string = "";
    constructor() {
        const kc = new k8s.KubeConfig();
        let defaultNamespace: string;
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
    public async getOperatorContainerStatuses(operatorName: string): Promise<k8s.V1ContainerStatus[]> {
        const containerStatuses: Array<k8s.V1ContainerStatus> = [];
        const pods = await this.getOperatorPods(operatorName);
        for (const pod of pods) {
            if (pod.status?.initContainerStatuses) {
                for (const initContainerStatus of pod.status?.initContainerStatuses) {
                    containerStatuses.push(initContainerStatus);
                }
            }
            if (pod.status?.containerStatuses) {
                for (const containerStatus of pod.status?.containerStatuses) {
                    containerStatuses.push(containerStatus);
                }
            }
        }
        return containerStatuses;
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
}