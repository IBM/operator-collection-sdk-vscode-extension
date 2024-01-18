/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as k8s from "@kubernetes/client-node";
import * as util from "../utilities/util";
import { OcCommand } from "../shellCommands/ocCommand";
import { KubernetesContext } from "./kubernetesContext";
import { CustomResourcePhases } from "../utilities/commandConstants";
import { showErrorMessage } from "../utilities/toastModifiers";

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

interface OperatorCollectionInstance {
  apiVersion: string;
  kind: string;
  metadata: ObjectMetadata;
  spec?: OperatorCollectionSpec;
  status?: ObjectStatus;
}

interface OperatorCollectionSpec {
  collectionURL: string;
  collectionURLToken: string;
  signatureSecret: string;
  skipSignatureVerification: boolean;
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
export class KubernetesObj extends KubernetesContext {
  /**
   * Validate if user is logged into an OCP Cluster
   * @returns - A promise containing a boolean
   */
  public async isUserLoggedIntoOCP(): Promise<boolean> {
    if (this.coreV1Api) {
      return this.coreV1Api
        .listNamespacedPod(this.namespace)
        .then(() => {
          return true;
        })
        .catch(() => {
          vscode.window.showWarningMessage("Log in to an OpenShift Cluster to use this extension");
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
  public async getOperatorPods(operatorName: string): Promise<k8s.V1Pod[] | undefined> {
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
        const msg = `Failure retrieving Pods in namespace. ${JSON.stringify(e)}`;
        console.error(msg);
        showErrorMessage(msg);
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
  public async downloadContainerLogs(podName: string, containerName: string): Promise<string | undefined> {
    return this.coreV1Api
      ?.readNamespacedPodLog(podName, this.namespace, containerName)
      .then(res => {
        return res.body;
      })
      .catch(e => {
        const errorMessage = e.body?.message as String;
        if (errorMessage.includes("PodInitializing")) {
          vscode.window.showWarningMessage("Unable to retrieve logs for this container while the Pod is initializing. Please try again after Pod initialization completes.");
          return undefined;
        }
        const msg = `Failure retrieving Pod logs. ${JSON.stringify(e)}`;
        console.error(msg);
        showErrorMessage(msg);
        return undefined;
      });
  }

  /**
   * Download the verbose container logs
   * @param podName - The pod name where the container resides
   * @param containerName - The container name within the pod
   * @param apiVersion - The resource API version
   * @param kind - The resource Kind
   * @param instanceName - The resource instance name
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A promise containing the path to the container log
   */
  public async downloadVerboseContainerLogs(podName: string, containerName: string, apiVersion: string, kind: string, instanceName: string, outputChannel?: vscode.OutputChannel, logPath?: string): Promise<string | undefined> {
    const ocCmd = new OcCommand();
    return ocCmd
      .runOcExecCommand(podName, this.namespace, containerName, apiVersion, kind, instanceName, outputChannel, logPath)
      .then(data => {
        return data;
      })
      .catch(e => {
        const msg = `Failure running the "oc exec" command. ${e}`;
        if ((e as string).includes("No such file or directory")) {
          console.error(msg);
          vscode.window.showWarningMessage("Ansible-Runner task logs not yet generated for Custom Resource instance");
          return undefined;
        } else {
          showErrorMessage(msg);
          return undefined;
        }
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
      ?.listNamespacedCustomObject("suboperator.zoscb.ibm.com", apiVersion, this.namespace, `${kind.toLowerCase()}s`)
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
          const msg = `Failure retrieving Custom Resource list. ${e.response.statusMessage}`;
          console.error(msg);
          showErrorMessage(msg);
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
        ?.deleteNamespacedCustomObject(util.customResourceGroup, apiVersion, this.namespace, `${kind.toLowerCase()}s`, name)
        .then(() => {
          return true;
        })
        .catch(e => {
          if (e.response.statusCode && e.response.statusCode === 404) {
            // 404s are fine since there's a chance that the CRD or API Version hasn't yet been created on the cluster
            return false;
          } else {
            const msg = `Failure deleting Custom Resource object. ${e.response.statusMessage}`;
            console.error(msg);
            showErrorMessage(msg);
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

  private async getBrokerObjList(objPlural: string, operatorName?: string): Promise<ObjectList | undefined> {
    let objsString: string = "";
    if (objPlural !== "zosendpoints" && operatorName) {
      const labelSelector = `operator-name=${operatorName}`;
      return this.customObjectsApi
        ?.listNamespacedCustomObject(
          util.zosCloudBrokerGroup,
          util.subOperatorConfigApiVersion,
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
            const msg = `Failure retrieving Broker object list. ${JSON.stringify(e)}`;
            console.error(msg);
            showErrorMessage(msg);
            return undefined;
          }
        });
    } else {
      return this.customObjectsApi
        ?.listNamespacedCustomObject(util.zosCloudBrokerGroup, util.zosEndpointApiVersion, this.namespace, objPlural)
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
            const msg = `Failure retrieving Broker object list. ${JSON.stringify(e)}`;
            console.error(msg);
            showErrorMessage(msg);
            return undefined;
          }
        });
    }
  }

  /**
   * Retrieve a custom resource object
   * @param kind - The custom resource Kind
   * @param name - The custom resource Name
   * @param group - The custom resource Group
   * @param version - The custom resource API Version
   * @returns - A promise containing the custom resource object
   */
  public async getCustomResourceObj(kind: string, name: string, group: string, version: string): Promise<object | undefined> {
    return this.customObjectsApi
      ?.getNamespacedCustomObject(group, version, this.namespace, `${kind.toLowerCase()}s`, name)
      .then(res => {
        return res.body;
      })
      .catch(e => {
        const msg = `Failure retrieving custom resource object. ${JSON.stringify(e)}`;
        console.error(msg);
        showErrorMessage(msg);
        return undefined;
      });
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
      ?.listNamespacedCustomObject("suboperator.zoscb.ibm.com", apiVersion, this.namespace, `${kind.toLowerCase()}s`)
      .then(res => {
        let crInstacesString = JSON.stringify(res.body);
        let crInstanceList: ObjectList = JSON.parse(crInstacesString);

        if (crInstanceList.items.length === 0) {
          vscode.window.showInformationMessage(`Verbose logs unavailable: No instances exists for the ${kind} kind`);
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
          const msg = `Failure retrieving Custom Resource instance names. ${JSON.stringify(e)}`;
          console.error(msg);
          showErrorMessage(msg);
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

  /**
   * Retrieves the z/OS Cloud Broker CSV Object
   * @returns - A promise containing the z/OS Cloud Broker CSV Object
   */
  public async getZosCloudBrokerCsv(): Promise<ObjectInstance | undefined> {
    const labelSelector = `operators.coreos.com/ibm-zoscb.${this.namespace}=`;
    return this.customObjectsApi
      ?.listNamespacedCustomObject(
        util.clusterServiceVersionGroup,
        util.clusterServiceVersionApiVersion,
        this.namespace,
        "clusterserviceversions",
        undefined, // pretty
        undefined, // allowWatchBookmarks
        undefined, // continue
        undefined, // fieldSelector
        labelSelector
      )
      .then(res => {
        if (res.response.statusCode !== 200) {
          return undefined;
        }
        let csvInstacesString = JSON.stringify(res.body);
        let csvInstanceList: ObjectList = JSON.parse(csvInstacesString);
        if (csvInstanceList.items.length > 0) {
          return csvInstanceList.items[0];
        } else {
          return undefined;
        }
      })
      .catch(e => {
        const msg: any = `Failure retrieving ClusterServiceVersion. ${e}`;
        console.error(msg);
        showErrorMessage(msg.toString());
        throw new Error(msg);
      });
  }

  /**
   * Retrieves the z/OS Cloud Broker CSV Release
   * @returns - A promise containing the z/OS Cloud Broker CSV Release string
   */
  public async getZosCloudBrokerRelease(): Promise<string | undefined> {
    return this.getZosCloudBrokerCsv()
      .then(csv => {
        if (csv === undefined) {
          return undefined;
        }
        return csv.metadata.name.split("ibm-zoscb.")[1];
      })
      .catch(e => {
        throw new Error(e);
      });
  }

  /**
   * Retrieves the z/OS Cloud Broker CSV name
   * @returns - A promise containing the z/OS Cloud Broker CSV name string
   */
  private async getZosCloudBrokerCsvName(): Promise<string | undefined> {
    return this.getZosCloudBrokerCsv()
      .then(csv => {
        if (csv === undefined) {
          return undefined;
        }
        return csv.metadata.name;
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure retrieving ZosCloudBroker CSV name: ${errorObjectString}`);
      });
  }

  /**
   * Validate is a ZosCloudBroker instance is created in the current namespace
   * @returns - A promise containing a boolean, return true if an instance exists
   */
  public async zosCloudBrokerInstanceCreated(): Promise<boolean | undefined> {
    return this.customObjectsApi
      ?.listNamespacedCustomObject(util.zosCloudBrokerGroup, util.zosCloudBrokerApiVersion, this.namespace, "zoscloudbrokers")
      .then(res => {
        if (res.response.statusCode && res.response.statusCode === 200) {
          let zosCloudBrokerInstancesListString = JSON.stringify(res.body);
          let zosCloudBrokerInstanceList: ObjectList = JSON.parse(zosCloudBrokerInstancesListString);
          if (zosCloudBrokerInstanceList.items.length === 0) {
            return false;
          }
          const zosCloudBrokerInstance: ObjectInstance = zosCloudBrokerInstanceList.items[0];
          if (zosCloudBrokerInstance.status?.phase !== CustomResourcePhases.successful) {
            return false;
          } else {
            return true;
          }
        } else {
          return false;
        }
      })
      .catch(e => {
        const errorObjectString = JSON.stringify(e);
        throw new Error(`Failure validating ZosCloudBroker instance: ${errorObjectString}`);
      });
  }

  public async isCustomResourceOperatorInstalled(csvName: string): Promise<boolean | undefined> {
    return this.customObjectsApi
      ?.getNamespacedCustomObject(util.clusterServiceVersionGroup, util.clusterServiceVersionApiVersion, this.namespace, "clusterserviceversions", csvName)
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
    return this.coreV1Api
      ?.listNamespace()
      .then(res => {
        if (res.response.statusCode === 200) {
          let namespacesString = JSON.stringify(res.body);
          let namespacesbjectList: ObjectList = JSON.parse(namespacesString);
          for (const namespaces of namespacesbjectList.items) {
            namespaceList.push(namespaces.metadata.name);
          }
          return namespaceList;
        } else {
          return undefined;
        }
      })
      .catch(e => {
        // Bypass 403 and 401 error messages since these will always occur when the user is logged out
        if (e.statusCode !== 403 && e.statusCode !== 401) {
          const msg = `Failure retrieving Namespace list: ${JSON.stringify(e)}`;
          console.error(msg);
        }
        return undefined;
      });
  }

  /**
   * Validates if the namespace exists on the cluster list
   * @returns - A promise containing a list of namespaces if the namespace exist in the list
   */
  public async validateNamespaceExists(): Promise<boolean | undefined> {
    return this.coreV1Api
      ?.readNamespace(this.namespace)
      ?.then(() => {
        return true;
      })
      .catch(() => {
        console.log("Failure retrieving Namespace " + this.namespace);
        return false;
      });
  }

  public async signatureValidationRequiredForOperator(operatorName: string, version: string): Promise<boolean | undefined> {
    const labelSelector = `operator-name=${operatorName},operator-version=${version}`;
    return this.customObjectsApi
      ?.listNamespacedCustomObject(
        util.zosCloudBrokerGroup,
        util.operatorCollectionApiVersion,
        this.namespace,
        "operatorcollections",
        undefined, // pretty
        undefined, // allowWatchBookmarks
        undefined, // continue
        undefined, // fieldSelector
        labelSelector
      )
      .then(res => {
        const objsString = JSON.stringify(res.body);
        const objsList: ObjectList = JSON.parse(objsString);
        if (objsList.items.length === 0) {
          showErrorMessage("OperatorCollection resource not detected in namespace");
          return undefined;
        } else if (objsList.items.length > 1) {
          showErrorMessage("Duplicate OperatorCollection resources detected in namespace");
          return undefined;
        } else {
          const operatorCollection: OperatorCollectionInstance = objsList.items[0];
          if (operatorCollection.spec?.signatureSecret === undefined || operatorCollection.spec?.signatureSecret === "") {
            return false;
          } else {
            return true;
          }
        }
      })
      .catch(e => {
        const msg = `Failure retrieving OperatorCollections list. ${JSON.stringify(e)}`;
        console.error(msg);
        showErrorMessage(msg);
        return undefined;
      });
  }
}
