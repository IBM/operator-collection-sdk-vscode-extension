import * as k8s from '@kubernetes/client-node';
import * as fs from "fs";

export class KubernetesContext {
    public coreV1Api: k8s.CoreV1Api;
    public customObjectsApi: k8s.CustomObjectsApi;
    public namespace: string = "";
    public openshiftServerURL: string | undefined  = "";
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

        this.openshiftServerURL = kc.getCurrentCluster()?.server;
        this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
        this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
    }
}