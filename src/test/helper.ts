import * as path from "path";
import * as fs from "fs-extra";
import * as k8sClient from "@kubernetes/client-node";
import { CustomResourcePhases } from "../utilities/commandConstants";
import { KubernetesContext } from "../kubernetes/kubernetesContext";

interface ObjectList {
  apiVersion: string;
  items: Array<ObjectInstance>;
}

export interface ObjectInstance {
  apiVersion: string;
  kind: string;
  metadata: ObjectMetadata;
  status?: ObjectStatus;
}

interface ObjectMetadata {
  name: string;
  namespace: string;
  deletionTimestamp?: string;
}

interface ObjectStatus {
  phase?: string;
}

interface RouteObject {
  metadata: ObjectMetadata;
  spec: RouteObjectSpec;
}

interface RouteObjectSpec {
  host: string;
}

interface SubscriptionObject {
  metadata: ObjectMetadata;
  spec: SubscriptionObjectSpec;
  status?: SubscriptionObjectStatus;
}

interface SubscriptionObjectSpec {
  channel: string;
  installPlanApproval: string;
  name: string;
  source: string;
  sourceNamespace: string;
  startingCSV: string;
}

interface SubscriptionObjectStatus {
  currentCSV: string;
  installedCSV: string;
}
export enum ZosCloudBrokerKinds {
  zosEndpoint = "ZosEndpoint",
  subOperatorConfig = "SubOperatorConfig",
  operatorCollection = "OperatorCollection",
}

export interface TestCluster {
  ocpServerUrl: string;
  ocpToken: string;
  ocpNamespace: string;
}

export const zosEndpointName: string = "zos-lpar";
export const zosCloudBrokerGroup: string = "zoscb.ibm.com";
export const clusterServiceVersionGroup: string = "operators.coreos.com";
export const customResourceGroup: string = "suboperator.zoscb.ibm.com";
export const clusterServiceVersionApiVersion: string = "v1alpha1";
export const zosEndpointApiVersion: string = "v2beta2";
export const subOperatorConfigApiVersion: string = "v2beta2";
export const operatorCollectionApiVersion: string = "v2beta2";
export const zosCloudBrokerApiVersion: string = "v2beta1";
export const zosCloudBrokerCsvVersion: string = "ibm-zoscb.v2.2.2";

export function displayCmdOutput(logPath: string) {
  if (fs.existsSync(logPath)) {
    const log = fs.readFileSync(logPath);
    console.log(log.toString());
  }
}
export function getTestClusterInfo(): TestCluster | Error {
  const serverUrl = process.env.OCP_SERVER_URL;
  let errorMessage: string = "";
  if (serverUrl === undefined) {
    errorMessage = errorMessage.concat("Please set the OCP_SERVER_URL environment variable, or login to an OCP cluster\n");
  }

  const ocpToken = process.env.OCP_TOKEN;
  if (ocpToken === undefined) {
    errorMessage = errorMessage.concat("Please set the OCP_TOKEN environment variable, or login to an OCP cluster\n");
  }

  const ocpNamespace = process.env.OCP_NAMESPACE;
  if (ocpNamespace === undefined) {
    errorMessage = errorMessage.concat("Please set the OCP_NAMESPACE environment variable, or login to an OCP cluster\n");
  }

  if (errorMessage !== "") {
    return new Error(errorMessage);
  } else {
    return {
      ocpServerUrl: serverUrl!,
      ocpToken: ocpToken!,
      ocpNamespace: ocpNamespace?.toLowerCase()!,
    };
  }
}

export async function pollOperatorInstallStatus(operatorName: string, attempts: number) {
  const k8s = new TestKubernetesObj();
  let i = 0;
  let zosEndpointInstalled: boolean = false;
  let operatorCollectionInstalled: boolean = false;
  let subOperatorConfigInstalled: boolean = false;
  let maxAttemptsPerTask: number = Math.floor(attempts / 3);
  return await new Promise((resolve, reject) => {
    const interval = setInterval(async (): Promise<void> => {
      if (++i === attempts) {
        reject();
        clearInterval(interval);
      }
      console.log(`Install attempt #${i}`);
      try {
        if (!zosEndpointInstalled && !(await zosEndpointInstalledSuccessfully(k8s))) {
          if (i === maxAttemptsPerTask) {
            reject();
            clearInterval(interval);
          }
          console.log("Waiting for ZosEndpoint to install successfully...");
          return;
        } else {
          zosEndpointInstalled = true;
        }

        if (!operatorCollectionInstalled && !(await operatorCollectionInstalledSuccessfully(operatorName, k8s))) {
          if (i === maxAttemptsPerTask * 2) {
            reject();
            clearInterval(interval);
          }
          console.log("Waiting for OperatorCollection to install successfully...");
          return;
        } else {
          operatorCollectionInstalled = true;
        }
        if (!subOperatorConfigInstalled && !(await subOperatorConfigInstalledSuccessfully(operatorName, k8s))) {
          console.log("Waiting for SubOperatorConfig to install successfully...");
          return;
        } else {
          subOperatorConfigInstalled = true;
        }
        resolve(true);
        clearInterval(interval);
      } catch (e) {
        reject();
      }
    }, 5000);
  });
}

export async function pollOperatorDeleteStatus(operatorName: string, attempts: number) {
  const k8s = new TestKubernetesObj();
  let i = 0;
  let operatorCollectionDeleted: boolean = false;
  let subOperatorConfigDeleted: boolean = false;
  return await new Promise((resolve, reject) => {
    const interval = setInterval(async (): Promise<void> => {
      if (++i === attempts) {
        reject();
        clearInterval(interval);
      }
      console.log(`Delete attempt #${i}`);
      try {
        if (!operatorCollectionDeleted && !(await operatorCollectionDeletedSuccessfully(operatorName, k8s))) {
          console.log("Waiting for OperatorCollection to delete successfully...");
          return;
        } else {
          operatorCollectionDeleted = true;
        }
        if (!subOperatorConfigDeleted && !(await subOperatorConfigDeletedSuccessfully(operatorName, k8s))) {
          console.log("Waiting for SubOperatorConfig to delete successfully...");
          return;
        } else {
          subOperatorConfigDeleted = true;
        }
        resolve(true);
        clearInterval(interval);
      } catch (e) {
        reject();
      }
    }, 5000);
  });
}

export async function pollOperatorPodStatus(operatorName: string, oldPodName: string, attempts: number) {
  const k8s = new TestKubernetesObj();
  let i = 0;
  return await new Promise((resolve, reject) => {
    const interval = setInterval(async (): Promise<void> => {
      if (++i === attempts) {
        reject();
        clearInterval(interval);
      }
      console.log(`Pod status poll attempt #${i}`);
      try {
        if (!(await podReinstalledSuccessfully(operatorName, oldPodName, k8s))) {
          console.log("Waiting for operator Pod to restart successfully...");
          return;
        }
        resolve(true);
        clearInterval(interval);
      } catch (e) {
        reject();
      }
    }, 5000);
  });
}

async function podReinstalledSuccessfully(operatorName: string, oldPodName: string, k8s: TestKubernetesObj): Promise<boolean> {
  const pods = await k8s.getOperatorPods(operatorName);
  if (pods?.length === 0) {
    return false;
  }
  if (pods?.length === 1) {
    if (pods[0].metadata?.name === oldPodName) {
      return false;
    } else {
      return true;
    }
  }
  return false;
}

async function zosEndpointInstalledSuccessfully(k8s: TestKubernetesObj): Promise<boolean> {
  const zosEndpoints = await k8s.getZosEndpoints();
  const zosEndpoint = zosEndpoints?.items.find(zosEndpoint => zosEndpoint.metadata.name === zosEndpointName && zosEndpoint.status?.phase === CustomResourcePhases.successful);
  if (zosEndpoint) {
    return true;
  }
  return false;
}

async function operatorCollectionInstalledSuccessfully(operatorName: string, k8s: TestKubernetesObj): Promise<boolean> {
  const operatorCollections = await k8s.getOperatorCollections(operatorName);
  if (operatorCollections?.items.length === 1 && operatorCollections.items[0].status?.phase === CustomResourcePhases.successful) {
    return true;
  }
  return false;
}

async function operatorCollectionDeletedSuccessfully(operatorName: string, k8s: TestKubernetesObj): Promise<boolean> {
  const operatorCollections = await k8s.getOperatorCollections(operatorName);
  if (operatorCollections?.items.length === 0) {
    return true;
  }
  return false;
}

async function subOperatorConfigInstalledSuccessfully(operatorName: string, k8s: TestKubernetesObj): Promise<boolean> {
  const subOperatorConfigs = await k8s.getSubOperatorConfigs(operatorName);
  if (subOperatorConfigs?.items.length === 1 && subOperatorConfigs.items[0].status?.phase === CustomResourcePhases.successful) {
    return true;
  }
  return false;
}

async function subOperatorConfigDeletedSuccessfully(operatorName: string, k8s: TestKubernetesObj): Promise<boolean> {
  const subOperatorConfigs = await k8s.getSubOperatorConfigs(operatorName);
  if (subOperatorConfigs?.items.length === 0) {
    return true;
  }
  return false;
}

export class TestKubernetesObj extends KubernetesContext {
  constructor(namespace?: string) {
    super(namespace);
  }

  /**
   * Validate if user is logged into an OCP Cluster
   * @returns - A promise containing a boolean
   */
  public async isUserLoggedIntoOCP(): Promise<boolean> {
    if (this.coreV1Api) {
      return this.coreV1Api
        ?.listNamespacedPod(this.namespace)
        .then(res => {
          return true;
        })
        .catch(e => {
          console.log(JSON.stringify(e));
          return false;
        });
    } else {
      return false;
    }
  }

  /**
   * Returns a list of pods for the corresponding operator
   * @param operatorName - operator name
   * @returns - Promise containing a list of Pod objects
   */
  public async getOperatorPods(operatorName: string): Promise<k8sClient.V1Pod[] | undefined> {
    const podList: Array<string> = [];
    const labelSelector = `operator-name=${operatorName}`;
    return this.coreV1Api
      ?.listNamespacedPod(
        this.namespace,
        undefined, // pretty
        undefined, // allowWatchBookmarks
        undefined, // _continue
        undefined, // fieldSelector
        labelSelector
      )
      .then(res => {
        return res.body.items;
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        console.error(`Failure retrieving Pods in namespace. ${errorObjectString}`);
        return undefined;
      });
  }

  /**
   * Returns a list of containers in the corresponding operator pod
   * @param operatorName - operator name
   * @returns - Promise containing a list of Pod objects
   */
  public async getOperatorContainers(operatorName: string): Promise<k8sClient.V1Container[] | undefined> {
    const containers: Array<k8sClient.V1Container> = [];
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
  public async getOperatorContainerStatuses(operatorName: string, pod: k8sClient.V1Pod): Promise<k8sClient.V1ContainerStatus[]> {
    const containerStatuses: Array<k8sClient.V1ContainerStatus> = [];
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

  public setTerminatingStatus(containerStatus: k8sClient.V1ContainerStatus): void {
    if (containerStatus.state) {
      containerStatus.state.running = undefined;
      containerStatus.state.terminated = undefined;
      containerStatus.state.waiting = new k8sClient.V1ContainerState().waiting;
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
    return this.coreV1Api
      ?.readNamespacedPodLog(podName, this.namespace, containerName)
      .then(res => {
        if (!fs.existsSync(path.join(workspacePath, ".openshiftLogs"))) {
          fs.mkdirSync(path.join(workspacePath, ".openshiftLogs"));
        }
        const logsPath = path.join(workspacePath, ".openshiftLogs", `${podName}-${containerName}.log`);
        try {
          fs.writeFileSync(logsPath, Buffer.from(res.body));
        } catch (e) {
          const msg = `Failure downloading container logs. ${e}`;
          console.error(msg);
          return undefined;
        }
        return logsPath;
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        console.error(`Failure retrieving Pod logs. ${errorObjectString}`);
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
  public async downloadVerboseContainerLogs(podName: string, containerName: string, workspacePath: string, apiVersion: string, kind: string, instanceName: string, logPath?: string): Promise<string | undefined> {
    return "";
  }

  /**
   * Returns a list of namespaces on the OpenShift cluster
   * @returns - A promise containing a list of Namespace names
   */
  public async getNamespaceList(): Promise<string[] | undefined> {
    const namespaceList: Array<string> = [];
    return this.coreV1Api
      ?.listNamespace()
      .then(res => {
        let namespacesString = JSON.stringify(res.body);
        let namespacesbjectList: ObjectList = JSON.parse(namespacesString);
        for (const namespaces of namespacesbjectList.items) {
          namespaceList.push(namespaces.metadata.name);
        }
        return namespaceList;
      })
      .catch(e => {
        const msg = `Failure retrieving Namespace list: ${JSON.stringify(e)}`;
        console.error(msg);
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
    return this.customObjectsApi
      ?.listNamespacedCustomObject(customResourceGroup, apiVersion, this.namespace, `${kind.toLowerCase()}s`)
      .then(res => {
        let customResourcesString = JSON.stringify(res.body);
        let customResourcesList: ObjectList = JSON.parse(customResourcesString);
        return customResourcesList;
      })
      .catch(e => {
        if (e.response.statusCode && e.response.statusCode === 404) {
          // 404s are fine since there's a chance that the CRD or API Version hasn't yet been created on the cluster
          return undefined;
        } else {
          const errorObjectString = JSON.stringify(e);
          console.error(`Failure retrieving Custom Resource list. ${errorObjectString}`);
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
    if (this.customObjectsApi) {
      return this.customObjectsApi
        ?.deleteNamespacedCustomObject(customResourceGroup, apiVersion, this.namespace, `${kind.toLowerCase()}s`, name)
        .then(() => {
          return true;
        })
        .catch(e => {
          if (e.response.statusCode && e.response.statusCode === 404) {
            // 404s are fine since there's a chance that the CRD or API Version hasn't yet been created on the cluster
            return false;
          } else {
            const errorObjectString = JSON.stringify(e);
            console.error(`Failure deleting Custom Resource object. ${errorObjectString}`);
            return false;
          }
        });
    } else {
      return false;
    }
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

  public async getBrokerObjList(objPlural: string, operatorName?: string): Promise<ObjectList | undefined> {
    let objsString: string = "";
    if (objPlural !== "zosendpoints" && operatorName) {
      const labelSelector = `operator-name=${operatorName}`;
      return this.customObjectsApi
        ?.listNamespacedCustomObject(
          zosCloudBrokerGroup,
          subOperatorConfigApiVersion,
          this.namespace,
          objPlural,
          undefined, // pretty
          undefined, // allowWatchBookmarks
          undefined, // continue
          undefined, // fieldSelector
          labelSelector
        )
        .then(res => {
          objsString = JSON.stringify(res.body);
          let objsList: ObjectList = JSON.parse(objsString);
          return objsList;
        })
        .catch(e => {
          if (e.response.statusCode && e.response.statusCode === 404) {
            // 404s are fine since there's a chance that the CRD or API Version hasn't yet been created on the cluster
            return undefined;
          } else {
            const errorObjectString = JSON.stringify(e);
            console.error(`Failure retrieving Broker object list. ${errorObjectString}`);
            return undefined;
          }
        });
    } else {
      return this.customObjectsApi
        ?.listNamespacedCustomObject(zosCloudBrokerGroup, zosEndpointApiVersion, this.namespace, objPlural)
        .then(res => {
          objsString = JSON.stringify(res.body);
          let objsList: ObjectList = JSON.parse(objsString);
          return objsList;
        })
        .catch(e => {
          if (e.response.statusCode && e.response.statusCode === 404) {
            // 404s are fine since there's a chance that the CRD or API Version hasn't yet been created on the cluster
            return undefined;
          } else {
            const errorObjectString = JSON.stringify(e);
            console.error(`Failure retrieving Broker object list. ${errorObjectString}`);
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
    return this.customObjectsApi
      ?.listNamespacedCustomObject(customResourceGroup, apiVersion, this.namespace, `${kind.toLowerCase()}s`)
      .then(res => {
        let crInstacesString = JSON.stringify(res.body);
        let crInstanceList: ObjectList = JSON.parse(crInstacesString);

        if (crInstanceList.items.length === 0) {
          return undefined;
        }

        for (let items of crInstanceList.items) {
          crInstanceNames.push(items.metadata.name);
        }
        return crInstanceNames;
      })
      .catch(e => {
        if (e.response.statusCode && e.response.statusCode === 404) {
          return undefined;
        } else {
          const errorObjectString = JSON.stringify(e);
          console.error(`Failure retrieving Custom Resource instance names. ${errorObjectString}`);
          return undefined;
        }
      });
  }

  /**
   * Retrieves the OpenShift dashboard URL
   * @returns - A promise containing the OpenShift dashboard URL
   */
  public async getOpenshifConsoleUrl(): Promise<string> {
    let consoleRoute = await this.customObjectsApi?.getNamespacedCustomObject("route.openshift.io", "v1", "openshift-console", "routes", "console");
    let consoleRouteString = JSON.stringify(consoleRoute ? consoleRoute.body : "");
    let routeObj: RouteObject = JSON.parse(consoleRouteString);
    return routeObj.spec.host;
  }

  public async getZosCloudBrokerCsvName(): Promise<string | undefined> {
    const labelSelector = `operators.coreos.com/ibm-zoscb.${this.namespace}=`;
    return this.customObjectsApi
      ?.listNamespacedCustomObject(
        clusterServiceVersionGroup,
        clusterServiceVersionApiVersion,
        this.namespace,
        "clusterserviceversions",
        undefined, // pretty
        undefined, // allowWatchBookmarks
        undefined, // continue
        undefined, // fieldSelector
        labelSelector
      )
      .then(res => {
        let csvInstacesString = JSON.stringify(res.body);
        let csvInstanceList: ObjectList = JSON.parse(csvInstacesString);
        if (csvInstanceList.items.length > 0) {
          return csvInstanceList.items[0].metadata.name;
        } else {
          return undefined;
        }
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        console.error(`Failure retrieving ClusterServiceVersion. ${errorObjectString}`);
        return undefined;
      });
  }

  public async isCustomResourceOperatorInstalled(csvName: string): Promise<boolean | undefined> {
    return this.customObjectsApi
      ?.getNamespacedCustomObject(clusterServiceVersionGroup, clusterServiceVersionApiVersion, this.namespace, "clusterserviceversions", csvName)
      .then(res => {
        if (res.response.statusCode && res.response.statusCode === 200) {
          return true;
        }
      })
      .catch(() => {
        return false;
      });
  }

  public async getResourceUrl(kind: string, group: string, version: string, name: string, operatorCsvName?: string): Promise<string> {
    let consoleUrl = await this.getOpenshifConsoleUrl();
    if (kind === ZosCloudBrokerKinds.zosEndpoint || kind === ZosCloudBrokerKinds.subOperatorConfig || kind === ZosCloudBrokerKinds.operatorCollection) {
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
   * Validates if the namespace exists on the cluster
   * @returns - A promise containing a boolean
   */
  public async validateNamespaceExists(name: string): Promise<boolean | undefined> {
    const namespaceList: Array<string> = [];
    return this.coreV1Api
      ?.listNamespace()
      .then(res => {
        let namespacesString = JSON.stringify(res.body);
        let namespacesbjectList: ObjectList = JSON.parse(namespacesString);
        const namespaceExists = namespacesbjectList?.items.find(namespace => namespace.metadata.name === name);
        if (namespaceExists) {
          return true;
        } else {
          return false;
        }
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        console.error(`Failure retrieving Namespace list: ${errorObjectString}`);
        return undefined;
      });
  }

  public async createNamespace(name: string): Promise<ObjectInstance | undefined> {
    const existingNamespace = await this.validateNamespaceExists(name);
    if (existingNamespace) {
      return undefined;
    }

    const ns = {
      metadata: {
        name: name,
      },
    };
    return this.coreV1Api
      ?.createNamespace(ns)
      .then(res => {
        const namespaceObjString = JSON.stringify(res.body);
        const namespaceObj: ObjectInstance = JSON.parse(namespaceObjString);
        return namespaceObj;
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure creating Namespace: ${errorObjectString}`);
      });
  }

  private async getNamespace(name: string): Promise<k8sClient.V1Namespace | undefined> {
    return this.coreV1Api
      ?.readNamespace(name)
      .then(res => {
        return res.body;
      })
      .catch(e => {
        if (e.response.statusCode && e.response.statusCode === 404) {
          return undefined;
        }
        const errorObjectString = JSON.stringify(e);
        console.error(`Failure retrieving Namespace: ${errorObjectString}`);
        return undefined;
      });
  }

  private async deleteNamespace(name?: string): Promise<void> {
    let ns = this.namespace;
    if (name) {
      ns = name;
    }
    return this.coreV1Api
      ?.deleteNamespace(ns)
      .then(() => {})
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure deleting Namespace: ${errorObjectString}`);
      });
  }

  private async namespaceDeletedSuccessfully(name: string): Promise<boolean> {
    const ns = await this.getNamespace(name);
    if (ns) {
      return false;
    }
    return true;
  }

  public async installZosCloudBroker(): Promise<void> {
    let pollingAttemptsNeeded: number = 0;
    try {
      await this.createOperatorGroup();
      const subscription = await this.createBrokerSubscription();
      if (subscription) {
        pollingAttemptsNeeded += 25;
      }
      const zosCloudBroker = await this.createZosCloudBrokerInstance();
      if (zosCloudBroker) {
        pollingAttemptsNeeded += 25;
      }
      if (pollingAttemptsNeeded > 0) {
        await this.pollZosCloudBrokerInstallStatus(pollingAttemptsNeeded);
      }
    } catch (e) {
      throw new Error(`Failure installing ZosCloudBroker: ${e}`);
    }
  }

  public async cleanupNamespace(namespace?: string): Promise<void> {
    try {
      const zosEndpointDeleted = await this.deleteZosEndpoint();
      if (zosEndpointDeleted) {
        await this.pollZosEndpointDeletionStatus(10);
      }
      await this.deleteBrokerInstance();
      await this.deleteNamespace(namespace);
      await this.pollCleanupStatus(30, namespace);
    } catch (e) {
      throw new Error(`Failure cleaning up namespace: ${e}`);
    }
  }

  private async pollCleanupStatus(attempts: number, namespace?: string) {
    let ns = this.namespace;
    if (namespace) {
      ns = namespace;
    }
    let i = 0;
    let zosCloudBrokerDeleted: boolean = false;
    let namespaceDeleted: boolean = false;
    return await new Promise((resolve, reject) => {
      const interval = setInterval(async (): Promise<void> => {
        if (++i === attempts) {
          reject();
          clearInterval(interval);
        }
        console.log(`Cleanup attempt #${i}`);
        try {
          if (!zosCloudBrokerDeleted && !(await this.zosCloudBrokerDeletedSuccessfully())) {
            console.log("Waiting for ZosCloudBroker to delete successfully...");
            return;
          } else {
            zosCloudBrokerDeleted = true;
          }

          if (!namespaceDeleted && !(await this.namespaceDeletedSuccessfully(ns))) {
            console.log("Waiting for Namespace to delete successfully...");
            return;
          } else {
            namespaceDeleted = true;
          }
          resolve(true);
          clearInterval(interval);
        } catch (e) {
          reject();
        }
      }, 5000);
    });
  }

  private async pollZosCloudBrokerInstallStatus(attempts: number) {
    let i = 0;
    let subscriptionInstalled: boolean = false;
    let csvInstalled: boolean = false;
    let zosCloudBrokerInstalled: boolean = false;
    return await new Promise((resolve, reject) => {
      const interval = setInterval(async (): Promise<void> => {
        if (++i === attempts) {
          reject();
          clearInterval(interval);
        }
        console.log(`Install attempt #${i}`);
        try {
          if (!subscriptionInstalled && !(await this.subscriptionInstalledSuccessfully())) {
            console.log("Waiting for Subscription to install successfully...");
            return;
          } else {
            subscriptionInstalled = true;
          }

          if (!csvInstalled && !(await this.csvInstalledSuccessfully())) {
            console.log("Waiting for CSV to install successfully...");
            return;
          } else {
            csvInstalled = true;
          }
          if (!zosCloudBrokerInstalled && !(await this.zosCloudBrokerInstalledSuccessfully())) {
            console.log("Waiting for ZosCloudBroker to install successfully...");
            return;
          } else {
            zosCloudBrokerInstalled = true;
          }
          resolve(true);
          clearInterval(interval);
        } catch (e) {
          reject();
        }
      }, 5000);
    });
  }

  private async pollZosEndpointDeletionStatus(attempts: number) {
    let i = 0;
    return await new Promise((resolve, reject) => {
      const interval = setInterval(async (): Promise<void> => {
        if (++i === attempts) {
          reject();
          clearInterval(interval);
        }
        console.log(`Pod status poll attempt #${i}`);
        try {
          if (!(await this.zosEndpointDeletedSuccessfully())) {
            console.log("Waiting for ZosEndpoint to delete successfully...");
            return;
          }
          resolve(true);
          clearInterval(interval);
        } catch (e) {
          reject();
        }
      }, 5000);
    });
  }

  private async createOperatorGroup(): Promise<ObjectInstance | undefined> {
    const existingOperatorGroup = await this.getOperatorGroup();
    if (existingOperatorGroup) {
      return undefined;
    }

    const operatorGroup = {
      apiVersion: "operators.coreos.com/v1",
      kind: "OperatorGroup",
      metadata: {
        name: this.namespace,
        namespace: this.namespace,
      },
      spec: {
        targetNamespaces: [this.namespace],
        upgradeStrategy: "Default",
      },
    };

    return this.customObjectsApi
      ?.createNamespacedCustomObject("operators.coreos.com", "v1", this.namespace, "operatorgroups", operatorGroup)
      .then(res => {
        const operatorGroupObjString = JSON.stringify(res.body);
        const operatorGroupObj: ObjectInstance = JSON.parse(operatorGroupObjString);
        return operatorGroupObj;
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure creating OperatorGroup: ${errorObjectString}`);
      });
  }

  private async getOperatorGroup(): Promise<ObjectInstance | undefined> {
    return this.customObjectsApi
      ?.listNamespacedCustomObject("operators.coreos.com", "v1", this.namespace, "operatorgroups")
      .then(res => {
        if (res.response.statusCode && res.response.statusCode === 404) {
          return undefined;
        }
        const operatorGroupObjString = JSON.stringify(res.body);
        const operatorGroupList: ObjectList = JSON.parse(operatorGroupObjString);
        if (operatorGroupList.items.length > 1) {
          throw new Error("Multiple Operator Groups exists in namespace");
        } else {
          return operatorGroupList.items[0];
        }
      })
      .catch(e => {
        if (e.response.statusCode && e.response.statusCode === 404) {
          return undefined;
        } else {
          const errorObjectString = JSON.stringify(e);
          throw new Error(`Failure creating OperatorGroup: ${errorObjectString}`);
        }
      });
  }

  private async createBrokerSubscription(): Promise<SubscriptionObject | undefined> {
    const existingSubscription = await this.getBrokerSubscription();
    if (existingSubscription) {
      return undefined;
    }

    let source = process.env.CATALOGSOURCE_NAME;
    if (source === undefined) {
      source = "ibm-operator-catalog";
    }

    let sourceNamespace = process.env.CATALOGSOURCE_NAMESPACE;
    if (sourceNamespace === undefined) {
      sourceNamespace = "openshift-marketplace";
    }

    let startingCSV = process.env.CATALOGSOURCE_CSV;
    if (startingCSV === undefined) {
      startingCSV = zosCloudBrokerCsvVersion;
    }

    const subscription = {
      apiVersion: "operators.coreos.com/v1alpha1",
      kind: "Subscription",
      metadata: {
        name: "ibm-zoscb",
        namespace: this.namespace,
      },
      spec: {
        name: "ibm-zoscb",
        channel: "v2.2",
        installPlanApproval: "Automatic",
        source: source,
        sourceNamespace: sourceNamespace,
        startingCSV: startingCSV,
      },
    };

    return this.customObjectsApi
      ?.createNamespacedCustomObject("operators.coreos.com", "v1alpha1", this.namespace, "subscriptions", subscription)
      .then(res => {
        const subscriptionObjString = JSON.stringify(res.body);
        const subscriptionObj: SubscriptionObject = JSON.parse(subscriptionObjString);
        return subscriptionObj;
      })
      .catch(e => {
        if (e.response.statusCode && e.response.statusCode === 404) {
          return undefined;
        } else {
          const errorObjectString = JSON.stringify(e);
          throw new Error(`Failure creating Subscription: ${errorObjectString}`);
        }
      });
  }

  private async getBrokerSubscription(): Promise<SubscriptionObject | undefined> {
    return this.customObjectsApi
      ?.getNamespacedCustomObject("operators.coreos.com", "v1alpha1", this.namespace, "subscriptions", "ibm-zoscb")
      .then(res => {
        const subscriptionObjString = JSON.stringify(res.body);
        const subscriptionObj: SubscriptionObject = JSON.parse(subscriptionObjString);
        return subscriptionObj;
      })
      .catch(e => {
        if (e.response.statusCode && e.response.statusCode === 404) {
          return undefined;
        } else {
          const errorObjectString = JSON.stringify(e);
          throw new Error(`Failure retrieving Subscription: ${errorObjectString}`);
        }
      });
  }

  private async getBrokerCSV(): Promise<ObjectInstance | undefined> {
    let csv = process.env.CATALOGSOURCE_CSV;
    if (csv === undefined) {
      csv = zosCloudBrokerCsvVersion;
    }
    return this.customObjectsApi
      ?.getNamespacedCustomObject("operators.coreos.com", "v1alpha1", this.namespace, "clusterserviceversions", csv)
      .then(res => {
        const csvObjString = JSON.stringify(res.body);
        const csvObj: ObjectInstance = JSON.parse(csvObjString);
        return csvObj;
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure retrieving CSV: ${errorObjectString}`);
      });
  }

  private async subscriptionInstalledSuccessfully(): Promise<boolean> {
    const subscription = await this.getBrokerSubscription();
    if (subscription?.status?.installedCSV && subscription.status.currentCSV) {
      return true;
    }
    return false;
  }

  private async csvInstalledSuccessfully(): Promise<boolean> {
    const csv = await this.getBrokerCSV();
    if (csv?.status?.phase && csv?.status?.phase === CustomResourcePhases.succeeded) {
      return true;
    }
    return false;
  }

  private async createZosCloudBrokerInstance(): Promise<ObjectInstance | undefined> {
    const existingBrokerInstance = await this.getBrokerInstance();
    if (existingBrokerInstance) {
      return undefined;
    }
    const zosCloudBroker = {
      apiVersion: `${zosCloudBrokerGroup}/${zosCloudBrokerApiVersion}`,
      kind: "ZosCloudBroker",
      metadata: {
        name: "zoscloudbroker",
        namespace: this.namespace,
      },
      spec: {
        catalogResources: {},
        license: {
          accept: true,
        },
        logLevel: "trace",
        managerResources: {},
        multiNamespace: true,
        storage: {
          configure: false,
          enabled: false,
          size: "5Gi",
          volumeMode: "Filesystem",
        },
        uiResources: {},
      },
    };
    return this.customObjectsApi
      ?.createNamespacedCustomObject(zosCloudBrokerGroup, zosCloudBrokerApiVersion, this.namespace, "zoscloudbrokers", zosCloudBroker)
      .then(res => {
        const zosCloudBrokerObjString = JSON.stringify(res.body);
        const zosCloudBrokerObj: ObjectInstance = JSON.parse(zosCloudBrokerObjString);
        return zosCloudBrokerObj;
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure creating ZosCloudBroker: ${errorObjectString}`);
      });
  }

  private async getBrokerInstance(): Promise<ObjectInstance | undefined> {
    let csv = process.env.CATALOGSOURCE_CSV;
    if (csv === undefined) {
      csv = zosCloudBrokerCsvVersion;
    }
    return this.customObjectsApi
      ?.getNamespacedCustomObject(zosCloudBrokerGroup, zosCloudBrokerApiVersion, this.namespace, "zoscloudbrokers", "zoscloudbroker")
      .then(res => {
        const zosCloudBrokerObjString = JSON.stringify(res.body);
        const zosCloudBrokerObj: ObjectInstance = JSON.parse(zosCloudBrokerObjString);
        return zosCloudBrokerObj;
      })
      .catch(e => {
        if (e.response.statusCode && e.response.statusCode === 404) {
          return undefined;
        }
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure retrieving ZosCloudBroker: ${errorObjectString}`);
      });
  }

  private async deleteBrokerInstance() {
    try {
      await this.customObjectsApi?.deleteNamespacedCustomObject(zosCloudBrokerGroup, zosCloudBrokerApiVersion, this.namespace, "zoscloudbrokers", "zoscloudbroker");
    } catch (e) {
      // ignore errors here since a broker instance may not exist during the cleanup
      return;
    }
  }

  private async deleteZosEndpoint(): Promise<boolean> {
    try {
      await this.customObjectsApi?.deleteNamespacedCustomObject(zosCloudBrokerGroup, zosEndpointApiVersion, this.namespace, "zosendpoints", zosEndpointName);
      return true;
    } catch (e) {
      return false;
    }
  }

  private async zosEndpointDeletedSuccessfully(): Promise<boolean> {
    const zosEndpoints = await this.getZosEndpoints();
    const zosEndpoint = zosEndpoints?.items.find(zosEndpoint => zosEndpoint.metadata.name === zosEndpointName);
    if (zosEndpoint) {
      return false;
    }
    return true;
  }

  private async zosCloudBrokerInstalledSuccessfully(): Promise<boolean> {
    const zosCloudBroker = await this.getBrokerInstance();
    if (zosCloudBroker?.status?.phase && zosCloudBroker?.status?.phase === "Successful") {
      return true;
    }
    return false;
  }

  private async zosCloudBrokerDeletedSuccessfully(): Promise<boolean> {
    const zosCloudBroker = await this.getBrokerInstance();
    if (zosCloudBroker) {
      return false;
    }
    return true;
  }
}
