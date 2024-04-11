import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs-extra";
import * as path from "path";
import * as child_process from "child_process";
import { VSCodeCommands } from "../../utilities/commandConstants";
import * as testVars from "../testVars";
import * as helper from "../helper";
import { OperatorItem } from "../../treeViews/operatorItems/operatorItem";
import { OpenShiftItem } from "../../treeViews/openshiftItems/openshiftItem";
import { OperatorContainerItem } from "../../treeViews/operatorItems/operatorContainerItem";
import { OperatorPodItem } from "../../treeViews/operatorItems/operatorPodItem";
import { OperatorsTreeProvider } from "../../treeViews/providers/operatorProvider";
import { ResourcesTreeProvider } from "../../treeViews/providers/resourceProvider";
import { ZosEndpointItem } from "../../treeViews/resourceItems/zosendpointItem";
import { ZosEndpointsItem } from "../../treeViews/resourceItems/zosendpointsItem";
import { OperatorCollectionItem } from "../../treeViews/resourceItems/operatorCollectionItem";
import { OperatorCollectionsItem } from "../../treeViews/resourceItems/operatorCollectionsItem";
import { SubOperatorConfigItem } from "../../treeViews/resourceItems/subOperatorConfigItem";
import { SubOperatorConfigsItem } from "../../treeViews/resourceItems/subOperatorConfigsItem";
import { CustomResourceItem } from "../../treeViews/resourceItems/customResourceItem";
import { initResources, getPassingIcons } from "../../treeViews/icons";
import { Session } from "../../utilities/session";
import * as util from "../../utilities/util";
import * as k8sClient from "@kubernetes/client-node";
import { OcSdkCommand } from "../../shellCommands/ocSdkCommands";
import * as workspace from "../../utilities/workspace";

describe("Extension Test Suite", async () => {
  vscode.window.showInformationMessage("Start all tests.");
  const ocSdkCmd = new OcSdkCommand();
  const imsOperatorItem: OperatorItem | undefined = new OperatorItem("IBM Z and Cloud Modernization Stack - IMS Operator", "zos-ims-operator", testVars.imsOperatorCollectionPath);
  const cicsOperatorItem: OperatorItem | undefined = new OperatorItem("IBM Z and Cloud Modernization Stack - CICS TS Operator", "zos-cics-ts-operator", testVars.cicsOperatorCollectionPath);
  const ocLoginLogPath = path.join(__dirname, "ocLogin.log");
  const installSdkLogPath = path.join(__dirname, "installOcSdk.log");
  const updateProjectLogPath = path.join(__dirname, "updateProject.log");
  const deleteOperatorBeforeAllLogPath = path.join(__dirname, "deleteOperatorBeforeAll.log");
  const deleteOperatorAfterAllLogPath = path.join(__dirname, "deleteOperatorAfterAll.log");
  const createOperatorLogPath = path.join(__dirname, "createOperator.log");
  const redeployCollectionLogPath = path.join(__dirname, "redeployCollection.log");
  const redeployOperatorLogPath = path.join(__dirname, "redeployOperator.log");
  const downloadVerboseLogsLogPath = path.join(__dirname, "downloadVerboseLogs.log");
  const convertToAirgapCollectionLogPath = path.join(__dirname, "convertToAirgapCollection.log");

  enum ZosCloudBrokerKinds {
    zosEndpoint = "ZosEndpoint",
    subOperatorConfig = "SubOperatorConfig",
    operatorCollection = "OperatorCollection",
  }

  const zosCloudBrokerGroup: string = "zoscb.ibm.com";
  const zosEndpointApiVersion: string = "v2beta2";
  const subOperatorConfigApiVersion: string = "v2beta2";
  const operatorCollectionApiVersion: string = "v2beta2";

  let k8s: helper.TestKubernetesObj;
  let session: Session;
  let userLoggedIn: boolean = false;
  let extensionContext: vscode.ExtensionContext;

  before(async () => {
    const extension = vscode.extensions.getExtension("ibm.operator-collection-sdk");
    await extension?.activate();
    extensionContext = (global as any).testExtensionContext;
    initResources(extensionContext);

    let testClusterInfo: helper.TestCluster | Error | undefined;
    let namespace: string = "";
    k8s = new helper.TestKubernetesObj();
    userLoggedIn = await k8s.isUserLoggedIntoOCP();
    if (!userLoggedIn) {
      testClusterInfo = helper.getTestClusterInfo();
      if (testClusterInfo instanceof Error) {
        assert.fail(testClusterInfo);
      }

      // Login to Openshift
      const openShiftItem = new OpenShiftItem("OpenShift Cluster", k8s.openshiftServerURL, new vscode.ThemeIcon("cloud"), "openshift-cluster");
      console.log("openshift item: " + openShiftItem.description);

      let args: Array<string> = [`--server="${testClusterInfo.ocpServerUrl}"`, `--token="${testClusterInfo.ocpToken}"`];
      console.log("args: " + args);

      try {
        console.log("login path:" + ocLoginLogPath);
        vscode.commands.executeCommand(VSCodeCommands.login, openShiftItem, args, ocLoginLogPath);
        await util.sleep(5000);
        helper.displayCmdOutput(ocLoginLogPath);
      } catch (e) {
        console.log("Printing OC Login logs");
        helper.displayCmdOutput(ocLoginLogPath);
        assert.fail("Failure logging in to OCP cluster");
      }

      console.log("Attempting to log in");
      // Update K8s object to retrieve config after log in
      k8s = new helper.TestKubernetesObj();
      userLoggedIn = await k8s.isUserLoggedIntoOCP();
      assert.equal(userLoggedIn, true);

      namespace = (testClusterInfo as helper.TestCluster).ocpNamespace;

      // Create Namespace if not already created
      let namespaceObject: helper.ObjectInstance | undefined;
      try {
        namespaceObject = await k8s.createNamespace(namespace);
      } catch (e) {
        assert.fail(`Failure creating Namespace: ${e}`);
      }

      try {
        const namespaceObj = new OpenShiftItem("OpenShift Namespace", namespace, new vscode.ThemeIcon("account"), "openshift-namespace");
        vscode.commands.executeCommand(VSCodeCommands.updateProject, namespaceObj, updateProjectLogPath);
        await util.sleep(5000);
      } catch (e) {
        console.log("Printing Update Project command logs");
        helper.displayCmdOutput(updateProjectLogPath);
        assert.fail("Failure logging in to OCP cluster");
      }
      k8s = new helper.TestKubernetesObj(namespace);
    }

    if (namespace === "") {
      namespace = k8s.namespace;
    }

    // Install ZosCloudBroker if not already installed
    try {
      await k8s.installZosCloudBroker();
    } catch (e) {
      assert.fail(`Failure installing ZosCloudBroker: ${e}`);
    }

    await installOperatorCollectionSDK(installSdkLogPath);

    session = new Session(ocSdkCmd);
    await session.validateOcSDKInstallation();
    await session.validateOpenShiftAccess();
    await session.validateZosCloudBrokerInstallation();

    try {
      vscode.commands.executeCommand(VSCodeCommands.deleteOperator, imsOperatorItem, deleteOperatorBeforeAllLogPath);
      await helper.pollOperatorDeleteStatus(imsOperatorItem.operatorName, 10);
    } catch (e) {
      console.log("Printing Delete Operator command logs");
      helper.displayCmdOutput(deleteOperatorBeforeAllLogPath);
      assert.fail(`Failure executing deleteOperator command: ${e}`);
    }
  });

  after(async () => {
    if (fs.existsSync(installSdkLogPath)) {
      fs.unlinkSync(installSdkLogPath);
    }
    if (fs.existsSync(ocLoginLogPath)) {
      fs.unlinkSync(ocLoginLogPath);
    }
    if (fs.existsSync(updateProjectLogPath)) {
      fs.unlinkSync(updateProjectLogPath);
    }
    if (fs.existsSync(createOperatorLogPath)) {
      fs.unlinkSync(createOperatorLogPath);
    }
    if (fs.existsSync(redeployCollectionLogPath)) {
      fs.unlinkSync(redeployCollectionLogPath);
    }
    if (fs.existsSync(redeployOperatorLogPath)) {
      fs.unlinkSync(redeployOperatorLogPath);
    }
    if (fs.existsSync(deleteOperatorBeforeAllLogPath)) {
      fs.unlinkSync(deleteOperatorBeforeAllLogPath);
    }
    if (fs.existsSync(deleteOperatorBeforeAllLogPath)) {
      fs.unlinkSync(deleteOperatorBeforeAllLogPath);
    }
    if (fs.existsSync(downloadVerboseLogsLogPath)) {
      fs.unlinkSync(downloadVerboseLogsLogPath);
    }

    if (userLoggedIn) {
      try {
        vscode.commands.executeCommand(VSCodeCommands.deleteOperator, imsOperatorItem, deleteOperatorAfterAllLogPath);
        await helper.pollOperatorDeleteStatus(imsOperatorItem.operatorName, 10);
        if (process.env.CLEANUP_NAMESPACE) {
          console.log("Cleanup namespace");
          await k8s.cleanupNamespace();
        }
      } catch (e) {
        console.log("Printing Delete Operator command logs");
        helper.displayCmdOutput(deleteOperatorAfterAllLogPath);
        if (fs.existsSync(deleteOperatorAfterAllLogPath)) {
          fs.unlinkSync(deleteOperatorAfterAllLogPath);
        }
        console.log(`Failure performing cleanup: ${e}`);
      }
    }
  });

  describe("When validating commands", () => {
    it("Should create an operator", async () => {
      try {
        vscode.commands.executeCommand(VSCodeCommands.createOperator, imsOperatorItem, createOperatorLogPath);
        await helper.pollOperatorInstallStatus(imsOperatorItem.operatorName, 40);
      } catch (e) {
        console.log("Printing Create Operator logs");
        helper.displayCmdOutput(createOperatorLogPath);
        assert.fail("Failure executing createOperator command");
      }
    });
    it("Should redeploy the collection", async () => {
      try {
        const oldPod = await k8s.getOperatorPods(imsOperatorItem.operatorName);
        if (oldPod === undefined || oldPod.length !== 1) {
          assert.fail("Failure validating operator pods");
        }
        const oldPodName = oldPod[0].metadata?.name;
        vscode.commands.executeCommand(VSCodeCommands.redeployCollection, imsOperatorItem, redeployCollectionLogPath);
        await helper.pollOperatorPodStatus(imsOperatorItem.operatorName, oldPodName!, 40);
      } catch (e) {
        console.log("Printing Redeploy Collection logs");
        helper.displayCmdOutput(redeployCollectionLogPath);
        assert.fail("Failure executing redeployCollection command");
      }
    });
    it("Should redeploy the operator", async () => {
      try {
        vscode.commands.executeCommand(VSCodeCommands.redeployOperator, imsOperatorItem, redeployOperatorLogPath);
        await util.sleep(60000);
        await helper.pollOperatorInstallStatus(imsOperatorItem.operatorName, 40);
      } catch (e) {
        console.log("Printing Redeploy Operator logs");
        helper.displayCmdOutput(redeployOperatorLogPath);
        assert.fail("Failure executing redeployOperator command");
      }
    });
    it("Should download the container logs", async () => {
      const operatorContainerItems = await getOperatorContainerItems(imsOperatorItem);
      assert.equal(operatorContainerItems.length, 2);

      for (const containerItem of operatorContainerItems) {
        try {
          vscode.commands.executeCommand(VSCodeCommands.viewLogs, containerItem);
          await util.sleep(5000);
          const fileData = vscode.window.activeTextEditor?.document.getText();
          assert.notEqual(fileData, undefined);
          if (containerItem.containerStatus.name.startsWith("init")) {
            if (!fileData?.includes("playbooks")) {
              assert.fail("Failure parsing log data in init container");
            }
          } else {
            if (!fileData?.includes("New internal logger initialized")) {
              assert.fail("Failure parsing log data in container");
            }
          }
          assert.notEqual(fileData?.length, 0);
        } catch (e) {
          assert.fail("Failure executing log download command");
        }
      }
    });
  });

  describe("When validating the Tree View", () => {
    let operatorsTreeProvider: OperatorsTreeProvider;
    let resourcesTreeProvider: ResourcesTreeProvider;

    let imsOperator: OperatorItem;
    let imsOperatorResource: OperatorItem;
    let imsOperatorPod: OperatorPodItem;
    let imsPodObj: k8sClient.V1Pod;
    let imsZosEndpointParent: ZosEndpointItem;
    let imsOperatorCollectionParent: OperatorCollectionItem;
    let imsSubOperatorConfigParent: SubOperatorConfigItem;
    let imsCustomResourceParents: CustomResourceItem[];

    let cicsOperator: OperatorItem;
    let cicsOperatorResource: OperatorItem;
    let cicsZosEndpointParent: ZosEndpointItem;
    let cicsOperatorCollectionParent: OperatorCollectionItem;
    let cicsSubOperatorConfigParent: SubOperatorConfigItem;
    let cicsCustomResourceParents: CustomResourceItem[];

    let initContainerStatusFromPod: k8sClient.V1ContainerStatus | undefined;
    let containerStatusFromPod: k8sClient.V1ContainerStatus | undefined;

    let consoleUrl: string;

    it("Should validate the operator items", async () => {
      operatorsTreeProvider = new OperatorsTreeProvider(session);
      const parentOperators = await operatorsTreeProvider.getChildren();
      assert.equal(parentOperators.length, 2);
      assert.equal(parentOperators[0] instanceof OperatorItem, true);
      assert.equal(parentOperators[1] instanceof OperatorItem, true);

      // Validate IMS Operator root
      imsOperator = parentOperators.find(operatorTreeItem => operatorTreeItem instanceof OperatorItem && operatorTreeItem.operatorName === imsOperatorItem.operatorName) as OperatorItem;
      assert.equal(imsOperator.operatorDisplayName, imsOperatorItem.operatorDisplayName);
      assert.equal(imsOperator.operatorName, imsOperatorItem.operatorName);
      assert.equal(imsOperator.workspacePath, imsOperatorItem.workspacePath);
      assert.equal(imsOperator.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(imsOperator.contextValue, "operator");
      assert.ok((imsOperator.hasOwnProperty("iconPath"), "iconPath key not found int imsOperator object"));
      assert.equal(imsOperator.label, `Operator: ${imsOperatorItem.operatorDisplayName}`);

      // Validate CICS TS Operator root
      cicsOperator = parentOperators.find(operatorTreeItem => operatorTreeItem instanceof OperatorItem && operatorTreeItem.operatorName === cicsOperatorItem.operatorName) as OperatorItem;
      assert.equal(cicsOperator.operatorDisplayName, cicsOperatorItem.operatorDisplayName);
      assert.equal(cicsOperator.operatorName, cicsOperatorItem.operatorName);
      assert.equal(cicsOperator.workspacePath, cicsOperatorItem.workspacePath);
      assert.equal(cicsOperator.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(cicsOperator.contextValue, "operator");
      assert.ok((cicsOperator.hasOwnProperty("iconPath"), "iconPath key not found int cicsOperator object"));
      assert.equal(cicsOperator.label, `Operator: ${cicsOperatorItem.operatorDisplayName}`);
    });
    it("Should validate the IMS operator pod item", async () => {
      const imsOperatorPods = await operatorsTreeProvider.getChildren(imsOperator);
      assert.equal(imsOperatorPods.length, 1);
      assert.equal(imsOperatorPods[0] instanceof OperatorPodItem, true);

      // Retrieve pod from cluster to perform validation
      const pods = await k8s.getOperatorPods(imsOperator.operatorName);
      assert.notEqual(pods, undefined);
      assert.equal(pods?.length, 1);

      imsPodObj = pods![0];

      imsOperatorPod = imsOperatorPods[0] as OperatorPodItem;
      assert.equal(imsOperatorPod.podObj.metadata?.name, imsPodObj.metadata?.name);
      assert.equal(imsOperatorPod.podObj.metadata?.namespace, imsPodObj.metadata?.namespace);
      assert.deepEqual(imsOperatorPod.podObj.spec?.containers, imsPodObj.spec?.containers);

      const initContainerStatusFromItem = imsOperatorPod.containerStatus.find(containerStatus => containerStatus.name.startsWith("init"));
      const containerStatusFromItem = imsOperatorPod.containerStatus.find(containerStatus => !containerStatus.name.startsWith("init"));

      initContainerStatusFromPod = imsPodObj.status?.initContainerStatuses?.find(containerStatus => containerStatus.name.startsWith("init"));
      containerStatusFromPod = imsPodObj.status?.containerStatuses?.find(containerStatus => !containerStatus.name.startsWith("init"));

      assert.equal(initContainerStatusFromItem?.name, initContainerStatusFromPod?.name);
      assert.deepEqual(initContainerStatusFromItem?.state, initContainerStatusFromPod?.state);
      assert.equal(containerStatusFromItem?.name, containerStatusFromPod?.name);
      assert.deepEqual(containerStatusFromItem?.state, containerStatusFromPod?.state);

      assert.equal(imsOperatorPod.parentOperator, imsOperator);
      assert.equal(imsOperatorPod.label, `Pod: ${imsPodObj.metadata?.name!}`);
      assert.equal(imsOperatorPod.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);

      let darkIconPath = (
        imsOperatorPod.iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).dark;
      let lightIconPath = (
        imsOperatorPod.iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).light;
      assert.equal((darkIconPath as vscode.Uri).path, getPassingIcons().dark.path);
      assert.equal((lightIconPath as vscode.Uri).path, getPassingIcons().light.path);
    });
    it("Should validate the CICS TS Operator pod item is empty", async () => {
      const cicsOperatorPods = await operatorsTreeProvider.getChildren(cicsOperator);
      assert.equal(cicsOperatorPods.length, 0);
    });
    it("Should validate the IMS operator container items", async () => {
      const imsOperatorContainers = await operatorsTreeProvider.getChildren(imsOperatorPod);
      assert.equal(imsOperatorContainers.length, 2);
      assert.equal(imsOperatorContainers[0] instanceof OperatorContainerItem, true);
      assert.equal(imsOperatorContainers[1] instanceof OperatorContainerItem, true);

      const initContainerFromItem = imsOperatorContainers.find(container => container instanceof OperatorContainerItem && container.containerStatus.name.startsWith("init")) as OperatorContainerItem;
      const containerFromItem = imsOperatorContainers.find(container => container instanceof OperatorContainerItem && !container.containerStatus.name.startsWith("init")) as OperatorContainerItem;

      const initContainerFromPod = imsPodObj.spec?.initContainers?.find(container => container.name.startsWith("init"));
      const containerFromPod = imsPodObj.spec?.containers.find(container => !container.name.startsWith("init"));
      assert.deepEqual(initContainerFromItem.podObj.spec?.containers, imsOperatorPod.podObj.spec?.containers);
      assert.equal(initContainerFromItem.containerStatus.name, initContainerStatusFromPod?.name);
      assert.deepEqual(initContainerFromItem.containerStatus.state, initContainerStatusFromPod?.state);
      assert.equal(initContainerFromItem.parentOperator, imsOperatorPod.parentOperator);
      assert.equal(initContainerFromItem.label, `Container: ${initContainerFromPod?.name}`);
      assert.equal(initContainerFromItem.collapsibleState, vscode.TreeItemCollapsibleState.None);

      assert.deepEqual(containerFromItem.podObj.spec?.containers, imsOperatorPod.podObj.spec?.containers);
      assert.equal(containerFromItem.containerStatus.name, containerStatusFromPod?.name);
      assert.deepEqual(containerFromItem.containerStatus.state, containerStatusFromPod?.state);
      assert.equal(containerFromItem.parentOperator, imsOperatorPod.parentOperator);
      assert.equal(containerFromItem.label, `Container: ${containerFromPod?.name}`);
      assert.equal(containerFromItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
    });
    it("Should validate the Operator Items in OpenShift Resources", async () => {
      resourcesTreeProvider = new ResourcesTreeProvider(session);
      const parentOperators = await resourcesTreeProvider.getChildren();
      assert.equal(parentOperators.length, 2);
      assert.equal(parentOperators[0] instanceof OperatorItem, true);
      assert.equal(parentOperators[1] instanceof OperatorItem, true);

      // Validate IMS Operator resources
      imsOperatorResource = parentOperators.find(resourceTreeItem => resourceTreeItem instanceof OperatorItem && resourceTreeItem.operatorName === imsOperatorItem.operatorName) as OperatorItem;
      assert.equal(imsOperatorResource.operatorDisplayName, imsOperatorItem.operatorDisplayName);
      assert.equal(imsOperatorResource.operatorName, imsOperatorItem.operatorName);
      assert.equal(imsOperatorResource.workspacePath, imsOperatorItem.workspacePath);
      assert.equal(imsOperatorResource.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(imsOperatorResource.contextValue, "operator");
      assert.ok((imsOperatorResource.hasOwnProperty("iconPath"), "iconPath key not found int imsOperatorResource object"));
      assert.equal(imsOperatorResource.label, `Operator: ${imsOperatorItem.operatorDisplayName}`);

      // Validate CICS TS Operator resources
      cicsOperatorResource = parentOperators.find(resourceTreeItem => resourceTreeItem instanceof OperatorItem && resourceTreeItem.operatorName === cicsOperatorItem.operatorName) as OperatorItem;
      assert.equal(cicsOperatorResource.operatorDisplayName, cicsOperatorItem.operatorDisplayName);
      assert.equal(cicsOperatorResource.operatorName, cicsOperatorItem.operatorName);
      assert.equal(cicsOperatorResource.workspacePath, cicsOperatorItem.workspacePath);
      assert.equal(cicsOperatorResource.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(cicsOperatorResource.contextValue, "operator");
      assert.ok((cicsOperatorResource.hasOwnProperty("iconPath"), "iconPath key not found int cicsOperatorResource object"));
      assert.equal(cicsOperatorResource.label, `Operator: ${cicsOperatorItem.operatorDisplayName}`);
    });
    it("Should validate the IMS Broker Custom Resources in OpenShift Resources", async () => {
      const imsBrokerCustomResoures = await resourcesTreeProvider.getChildren(imsOperatorResource);
      imsZosEndpointParent = imsBrokerCustomResoures.find(brokerResource => brokerResource instanceof ZosEndpointItem) as ZosEndpointItem;
      assert.notEqual(imsZosEndpointParent, undefined);
      assert.equal(imsZosEndpointParent.parentOperator, imsOperatorResource);
      assert.equal(imsZosEndpointParent.label, "ZosEndpoints");
      assert.equal(imsZosEndpointParent.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(imsZosEndpointParent.contextValue, "zosendpoint");

      imsOperatorCollectionParent = imsBrokerCustomResoures.find(brokerResource => brokerResource instanceof OperatorCollectionItem) as OperatorCollectionItem;
      assert.notEqual(imsOperatorCollectionParent, undefined);
      assert.equal(imsOperatorCollectionParent.parentOperator, imsOperatorResource);
      assert.equal(imsOperatorCollectionParent.label, "OperatorCollections");
      assert.equal(imsOperatorCollectionParent.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(imsOperatorCollectionParent.contextValue, "operatorcollections");

      imsSubOperatorConfigParent = imsBrokerCustomResoures.find(brokerResource => brokerResource instanceof SubOperatorConfigItem) as SubOperatorConfigItem;
      assert.notEqual(imsSubOperatorConfigParent, undefined);
      assert.equal(imsSubOperatorConfigParent.parentOperator, imsOperatorResource);
      assert.equal(imsSubOperatorConfigParent.label, "SubOperatorConfigs");
      assert.equal(imsSubOperatorConfigParent.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(imsSubOperatorConfigParent.contextValue, "suboperatorconig");

      imsCustomResourceParents = imsBrokerCustomResoures.filter(brokerResource => brokerResource instanceof CustomResourceItem) as CustomResourceItem[];
      const tmdbKind = "TMDB";
      const imsApiVersion = "v1minor1patch0";
      const imsCSVName = "ibm-zos-ims-operator-operator.v1.1.0";
      consoleUrl = await k8s.getOpenshifConsoleUrl();

      const operatorInstalled = await k8s.isCustomResourceOperatorInstalled(imsCSVName);
      let createCustomResourceUrl: string = "";
      if (operatorInstalled) {
        createCustomResourceUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/clusterserviceversions/${imsCSVName}/${util.customResourceGroup}~${imsApiVersion}~${tmdbKind}/~new`;
      } else {
        createCustomResourceUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/${util.customResourceGroup}~${imsApiVersion}~${tmdbKind}/~new`;
      }

      assert.equal(imsCustomResourceParents.length, 1);
      assert.equal(imsCustomResourceParents[0].kind, tmdbKind);
      assert.equal(imsCustomResourceParents[0].apiVersion, imsApiVersion);
      assert.equal(imsCustomResourceParents[0].operatorCsvName, imsCSVName);
      assert.equal(imsCustomResourceParents[0].link, createCustomResourceUrl);
      assert.equal(imsCustomResourceParents[0].label, "TMDBs");
      assert.equal(imsCustomResourceParents[0].collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(imsCustomResourceParents[0].contextValue, "customresources");
    });
    it("Should validate the CICS Broker Custom Resources in OpenShift Resources", async () => {
      const cicsBrokerCustomResoures = await resourcesTreeProvider.getChildren(cicsOperatorResource);
      cicsZosEndpointParent = cicsBrokerCustomResoures.find(brokerResource => brokerResource instanceof ZosEndpointItem) as ZosEndpointItem;
      assert.notEqual(cicsZosEndpointParent, undefined);
      assert.equal(cicsZosEndpointParent.parentOperator, cicsOperatorResource);
      assert.equal(cicsZosEndpointParent.label, "ZosEndpoints");
      assert.equal(cicsZosEndpointParent.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(cicsZosEndpointParent.contextValue, "zosendpoint");

      cicsOperatorCollectionParent = cicsBrokerCustomResoures.find(brokerResource => brokerResource instanceof OperatorCollectionItem) as OperatorCollectionItem;
      assert.notEqual(cicsOperatorCollectionParent, undefined);
      assert.equal(cicsOperatorCollectionParent.parentOperator, cicsOperatorResource);
      assert.equal(cicsOperatorCollectionParent.label, "OperatorCollections");
      assert.equal(cicsOperatorCollectionParent.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(cicsOperatorCollectionParent.contextValue, "operatorcollections");

      cicsSubOperatorConfigParent = cicsBrokerCustomResoures.find(brokerResource => brokerResource instanceof SubOperatorConfigItem) as SubOperatorConfigItem;
      assert.notEqual(cicsSubOperatorConfigParent, undefined);
      assert.equal(cicsSubOperatorConfigParent.parentOperator, cicsOperatorResource);
      assert.equal(cicsSubOperatorConfigParent.label, "SubOperatorConfigs");
      assert.equal(cicsSubOperatorConfigParent.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(cicsSubOperatorConfigParent.contextValue, "suboperatorconig");

      cicsCustomResourceParents = cicsBrokerCustomResoures.filter(brokerResource => brokerResource instanceof CustomResourceItem) as CustomResourceItem[];
      const cicsKind = "CICSTSRegion";
      const cicsApiVersion = "v1minor0patch0";
      const cicsCSVName = "ibm-zos-cics-ts-operator-operator.v1.0.0";
      consoleUrl = await k8s.getOpenshifConsoleUrl();
      const createCustomResourceUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/suboperator.zoscb.ibm.com~${cicsApiVersion}~${cicsKind}/~new`;

      assert.equal(cicsCustomResourceParents.length, 1);
      assert.equal(cicsCustomResourceParents[0].kind, cicsKind);
      assert.equal(cicsCustomResourceParents[0].apiVersion, cicsApiVersion);
      assert.equal(cicsCustomResourceParents[0].operatorCsvName, cicsCSVName);
      assert.equal(cicsCustomResourceParents[0].link, createCustomResourceUrl);
      assert.equal(cicsCustomResourceParents[0].label, "CICSTSRegions");
      assert.equal(cicsCustomResourceParents[0].collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
      assert.equal(cicsCustomResourceParents[0].contextValue, "customresources");
    });
    it("Should validate the IMS ZosEndpoints", async () => {
      const imsZosEndpoints = (await resourcesTreeProvider.getChildren(imsZosEndpointParent)) as ZosEndpointsItem[];
      assert.equal(imsZosEndpoints.length, 1);

      // Validate ZosEndpoint exists in OpenShift
      const zosendpoints = await k8s.getZosEndpoints();
      const zosendpoint = zosendpoints?.items.find(endpoint => endpoint.metadata.name === imsZosEndpoints[0].zosendpointObj.metadata.name);
      assert.notEqual(zosendpoint, undefined);

      const zosendpointUrl = await k8s.getResourceUrl(ZosCloudBrokerKinds.zosEndpoint, zosCloudBrokerGroup, zosEndpointApiVersion, zosendpoint!.metadata.name);
      assert.equal(imsZosEndpoints[0].link, zosendpointUrl);
      assert.equal(imsZosEndpoints[0].label, zosendpoint?.metadata.name);
      assert.equal(imsZosEndpoints[0].contextValue, "zosendpoint-object");
      assert.equal(imsZosEndpoints[0].collapsibleState, vscode.TreeItemCollapsibleState.None);

      const darkIconPath = (
        imsZosEndpoints[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).dark;
      const lightIconPath = (
        imsZosEndpoints[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).light;
      assert.equal((darkIconPath as vscode.Uri).path, getPassingIcons().dark.path);
      assert.equal((lightIconPath as vscode.Uri).path, getPassingIcons().light.path);
    });
    it("Should validate the CICS ZosEndpoints", async () => {
      const cicsZosEndpoints = (await resourcesTreeProvider.getChildren(cicsZosEndpointParent)) as ZosEndpointsItem[];
      assert.equal(cicsZosEndpoints.length, 1);

      // Validate ZosEndpoint exists in OpenShift
      const zosendpoints = await k8s.getZosEndpoints();
      const zosendpoint = zosendpoints?.items.find(endpoint => endpoint.metadata.name === cicsZosEndpoints[0].zosendpointObj.metadata.name);
      assert.notEqual(zosendpoint, undefined);

      const zosendpointUrl = await k8s.getResourceUrl(ZosCloudBrokerKinds.zosEndpoint, zosCloudBrokerGroup, zosEndpointApiVersion, zosendpoint!.metadata.name);
      assert.equal(cicsZosEndpoints[0].link, zosendpointUrl);
      assert.equal(cicsZosEndpoints[0].label, zosendpoint?.metadata.name);
      assert.equal(cicsZosEndpoints[0].contextValue, "zosendpoint-object");
      assert.equal(cicsZosEndpoints[0].collapsibleState, vscode.TreeItemCollapsibleState.None);

      const darkIconPath = (
        cicsZosEndpoints[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).dark;
      const lightIconPath = (
        cicsZosEndpoints[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).light;
      assert.equal((darkIconPath as vscode.Uri).path, getPassingIcons().dark.path);
      assert.equal((lightIconPath as vscode.Uri).path, getPassingIcons().light.path);
    });
    it("Should validate the IMS OperatorCollections", async () => {
      const imsOperatorCollections = (await resourcesTreeProvider.getChildren(imsOperatorCollectionParent)) as OperatorCollectionsItem[];
      assert.equal(imsOperatorCollections.length, 1);

      // Validate OperatorCollection exists in OpenShift
      const operatorCollections = await k8s.getOperatorCollections(imsOperatorCollectionParent.parentOperator.operatorName);
      const operatorCollection = operatorCollections?.items.find(oc => oc.metadata.name === imsOperatorCollections[0].operatorCollectionObj.metadata.name);
      assert.notEqual(operatorCollection, undefined);

      const operatorCollectionUrl = await k8s.getResourceUrl(ZosCloudBrokerKinds.operatorCollection, zosCloudBrokerGroup, operatorCollectionApiVersion, operatorCollection!.metadata.name);
      assert.equal(imsOperatorCollections[0].link, operatorCollectionUrl);
      assert.equal(imsOperatorCollections[0].label, operatorCollection?.metadata.name);
      assert.equal(imsOperatorCollections[0].contextValue, "operatorcollection-object");
      assert.equal(imsOperatorCollections[0].collapsibleState, vscode.TreeItemCollapsibleState.None);

      const darkIconPath = (
        imsOperatorCollections[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).dark;
      const lightIconPath = (
        imsOperatorCollections[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).light;
      assert.equal((darkIconPath as vscode.Uri).path, getPassingIcons().dark.path);
      assert.equal((lightIconPath as vscode.Uri).path, getPassingIcons().light.path);
    });
    it("Should validate that the CICS OperatorCollections are empty", async () => {
      const cicsOperatorCollections = (await resourcesTreeProvider.getChildren(cicsOperatorCollectionParent)) as OperatorCollectionsItem[];
      assert.equal(cicsOperatorCollections.length, 0);
    });
    it("Should validate the IMS SubOperatorConfigs", async () => {
      const imsSubOperatorConfigs = (await resourcesTreeProvider.getChildren(imsSubOperatorConfigParent)) as SubOperatorConfigsItem[];
      assert.equal(imsSubOperatorConfigs.length, 1);

      // Validate OperatorCollection exists in OpenShift
      const subOperatorConfigs = await k8s.getSubOperatorConfigs(imsSubOperatorConfigParent.parentOperator.operatorName);
      const subOperatorConfig = subOperatorConfigs?.items.find(soc => soc.metadata.name === imsSubOperatorConfigs[0].subOperatorConfigObj.metadata.name);
      assert.notEqual(subOperatorConfig, undefined);

      const subOperatorConfigUrl = await k8s.getResourceUrl(ZosCloudBrokerKinds.subOperatorConfig, zosCloudBrokerGroup, subOperatorConfigApiVersion, subOperatorConfig!.metadata.name);
      assert.equal(imsSubOperatorConfigs[0].link, subOperatorConfigUrl);
      assert.equal(imsSubOperatorConfigs[0].label, subOperatorConfig?.metadata.name);
      assert.equal(imsSubOperatorConfigs[0].contextValue, "suboperatorconfig-object");
      assert.equal(imsSubOperatorConfigs[0].collapsibleState, vscode.TreeItemCollapsibleState.None);

      const darkIconPath = (
        imsSubOperatorConfigs[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).dark;
      const lightIconPath = (
        imsSubOperatorConfigs[0].iconPath as {
          light: string | vscode.Uri;
          dark: string | vscode.Uri;
        }
      ).light;
      assert.equal((darkIconPath as vscode.Uri).path, getPassingIcons().dark.path);
      assert.equal((lightIconPath as vscode.Uri).path, getPassingIcons().light.path);
    });
    it("Should validate that the CICS SubOperatorConfigs are empty", async () => {
      const cicsSubOpeatorConfigs = (await resourcesTreeProvider.getChildren(cicsSubOperatorConfigParent)) as OperatorCollectionsItem[];
      assert.equal(cicsSubOpeatorConfigs.length, 0);
    });
    it("Should validate the IMS TMDB Custom Resource Instances", async () => {
      const imsCustomResources = (await resourcesTreeProvider.getChildren(imsCustomResourceParents[0])) as SubOperatorConfigsItem[];
      assert.equal(imsCustomResources.length, 0);
    });
    it("Should validate the CICS CICSTSRegion Custom Resource Instances", async () => {
      const cicsCustomResources = (await resourcesTreeProvider.getChildren(cicsCustomResourceParents[0])) as SubOperatorConfigsItem[];
      assert.equal(cicsCustomResources.length, 0);
    });
  });

  describe("When validating the operator-config yaml linter", async () => {
    let doc: vscode.TextDocument | undefined;
    let diagnostics: vscode.Diagnostic[] | undefined;
    let postDiagnostics: vscode.Diagnostic[] | undefined;

    before(async () => {
      doc = vscode.workspace.textDocuments.find((document: vscode.TextDocument) => document.fileName === `${testVars.cicsOperatorCollectionPath}/operator-config.yml`);
      if (doc === undefined) {
        doc = await vscode.workspace.openTextDocument(`${testVars.cicsOperatorCollectionPath}/operator-config.yml`);
      }
      const editor = vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri === doc.uri ? vscode.window.activeTextEditor : await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false);

      //Get document "symbols"
      //These are provided by the yaml extension
      //There is no way to check if the yaml extension has been loaded
      //So the only way to wait for it to load is to keep calling this
      //command until it succeeds.
      let docSymbols = undefined;
      while (!docSymbols) {
        docSymbols = (await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", doc.uri)) as vscode.DocumentSymbol[];
        //[Optional] Sleep to be mindful and not overload the command queue
        if (!docSymbols) {
          await util.sleep(100);
        }
      }

      //Create ansible.cfg file
      await vscode.workspace.fs.writeFile(vscode.Uri.file(`${testVars.cicsOperatorCollectionPath}/ansible.cfg`), new TextEncoder().encode(""));

      //Inject invalid key
      const displayNameSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "displayName");
      if (displayNameSymbol) {
        await editor.edit(editBuilder => {
          editBuilder.replace(displayNameSymbol.selectionRange, "linterShouldFlagThis");
        });
      } else {
        throw new Error("Error injecting invalid key linter errors into operator-config file.");
      }

      //Inject invalid domain
      const domainSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "domain");
      if (domainSymbol) {
        const domainSymbolValueRange = new vscode.Range(new vscode.Position(domainSymbol.selectionRange.end.line, domainSymbol.selectionRange.end.character + 2), domainSymbol.range.end);
        await editor.edit(editBuilder => {
          editBuilder.replace(domainSymbolValueRange, "invalidDomain");
        });
      } else {
        throw new Error("Error injecting domain linter errors into operator-config file.");
      }

      //Inject invalid name
      const nameSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "name");
      if (nameSymbol) {
        const nameSymbolValueRange = new vscode.Range(new vscode.Position(nameSymbol.selectionRange.end.line, nameSymbol.selectionRange.end.character + 2), nameSymbol.range.end);
        await editor.edit(editBuilder => {
          editBuilder.replace(nameSymbolValueRange, "invalid_name");
        });
      } else {
        throw new Error("Error injecting name linter errors into operator-config file.");
      }

      //Inject invalid version
      const versionSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "version");
      if (versionSymbol) {
        const versionSymbolValueRange = new vscode.Range(new vscode.Position(versionSymbol.selectionRange.end.line, versionSymbol.selectionRange.end.character + 2), versionSymbol.range.end);
        await editor.edit(editBuilder => {
          editBuilder.replace(versionSymbolValueRange, "invalidVersion");
        });
      } else {
        throw new Error("Error injecting version linter errors into operator-config file.");
      }

      //Store valid playbook for later
      let validPlaybook: string;
      //Inject invalid playbook
      //Get resources symbol
      const resourcesSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "resources");
      if (resourcesSymbol) {
        //Get resource symbol
        const resourceSymbol = resourcesSymbol.children[0];
        const playbook: vscode.DocumentSymbol | undefined = resourceSymbol.children.find((symbol: vscode.DocumentSymbol) => symbol.name === "playbook");
        if (playbook) {
          validPlaybook = playbook.detail;
          const playbookValueRange = new vscode.Range(new vscode.Position(playbook.selectionRange.end.line, playbook.selectionRange.end.character + 2), playbook.range.end);
          await editor.edit(editBuilder => {
            editBuilder.replace(playbookValueRange, `${testVars.cicsOperatorCollectionPath}/invalid_playbook.yml`);
          });
        } else {
          throw new Error("Error injecting playbook linter errors into operator-config file.");
        }
      } else {
        throw new Error("Error injecting playbook linter errors into operator-config file.");
      }

      //Inject invalid finalizer
      if (resourcesSymbol) {
        //Get resource symbol
        const resourceSymbol = resourcesSymbol.children[0];
        const finalizer: vscode.DocumentSymbol | undefined = resourceSymbol.children.find((symbol: vscode.DocumentSymbol) => symbol.name === "finalizer");
        if (finalizer) {
          const finalizerValueRange = new vscode.Range(new vscode.Position(finalizer.selectionRange.end.line, finalizer.selectionRange.end.character + 2), finalizer.range.end);
          await editor.edit(editBuilder => {
            editBuilder.replace(finalizerValueRange, `invalid_finalizer.yml`);
          });
        } else {
          throw new Error("Error injecting finalizer linter errors into operator-config file.");
        }
      } else {
        throw new Error("Error injecting finalizer linter errors into operator-config file.");
      }

      await util.sleep(5000); // Wait for linter to lint
      diagnostics = vscode.languages.getDiagnostics(doc.uri);

      //Open valid playbook and replace hosts: all value with other host to trigger linter error
      fs.readFileSync(path.join(path.dirname(doc.uri.fsPath), validPlaybook), "utf8");
      const playbookDoc = await vscode.workspace.openTextDocument(path.join(path.dirname(doc.uri.fsPath), validPlaybook));
      const playbookEditor = await vscode.window.showTextDocument(playbookDoc, vscode.ViewColumn.Beside, false);

      //Get playbook "symbols"
      const playbookDocSymbols = (await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", playbookDoc.uri)) as vscode.DocumentSymbol[];
      //Replace playbook hosts
      for (const symbol of playbookDocSymbols) {
        const playbookHost = symbol.children.find(childSymbol => childSymbol.name === "hosts");
        if (playbookHost) {
          const playbookHostValueRange = new vscode.Range(new vscode.Position(playbookHost.selectionRange.end.line, playbookHost.selectionRange.end.character + 2), playbookHost.range.end);
          //const playbookHostValueRange = doc.getWordRangeAtPosition(doc.positionAt(doc.offsetAt(new vscode.Position(playbookHost.selectionRange.end.line, playbookHost.selectionRange.end.character + 2))));
          if (playbookHostValueRange) {
            await playbookEditor.edit(editBuilder => {
              editBuilder.replace(playbookHostValueRange, "invalidHost");
            });
          }
          await playbookDoc.save();
        }
      }

      //Restore valid playbook
      if (resourcesSymbol) {
        //Get resource symbol
        const resourceSymbol = resourcesSymbol.children[0];
        const playbook: vscode.DocumentSymbol | undefined = resourceSymbol.children.find((symbol: vscode.DocumentSymbol) => symbol.name === "playbook");
        if (playbook) {
          const playbookValueRange = doc.getWordRangeAtPosition(doc.positionAt(doc.offsetAt(new vscode.Position(playbook.selectionRange.end.line, playbook.selectionRange.end.character + 2))));
          if (playbookValueRange) {
            await editor.edit(editBuilder => {
              editBuilder.replace(playbookValueRange, validPlaybook);
            });
          }
        } else {
          throw new Error("Error injecting playbook linter errors into operator-config file.");
        }
      } else {
        throw new Error("Error injecting playbook linter errors into operator-config file.");
      }

      await util.sleep(5000); // Wait for linter to lint again
      postDiagnostics = vscode.languages.getDiagnostics(doc.uri);
    });

    it("Should validate the linter lints missing required fields", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes('Missing property "displayName".')));
    });

    it("Should validate the linter lints domain mismatch", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes("Domain SHOULD match")));
    });

    it("Should validate the linter lints name mismatch", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes("Name SHOULD match")));
    });

    it("Should validate the linter lints version mismatch", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes("Version SHOULD match")));
    });

    it("Should validate the linter lists unknown key errors", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes("Property linterShouldFlagThis is not allowed")));
    });

    it("Should validate the linter detects ansible.cfg file as error", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes("Collection build MUST not contain an ansible.cfg file")));
    });

    it("Should validate the linter lints invalid playbook/finalizer absolute paths", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes("Playbook path MUST be relative")));
    });

    it("Should validate the linter lints invalid playbooks/finalizers", () => {
      assert.ok(diagnostics && diagnostics.some((diagnostic: vscode.Diagnostic) => diagnostic.message.includes("Invalid Finalizer for Kind")));
    });

    it("Should validate the linter lints playbooks host value", () => {
      assert.ok(postDiagnostics && postDiagnostics.some(diagnostic => diagnostic.message.includes('Playbook MUST use a "hosts: all" value')));
    });
  });

  xdescribe("When validating context-menu functions", async () => {
    const customCollectionPath = "";//testVars.customOperatorCollectionPath;
    const customCollectionURI = vscode.Uri.file(customCollectionPath);
    const customPlaybookName = "playbooks/customPlaybook.yml";

    before(() => {
      if (fs.existsSync(customCollectionPath)) {
        fs.rmSync(customCollectionPath, { recursive: true, force: true });
      }
      fs.mkdirSync(path.join(customCollectionPath, "collections"), { recursive: true });

      const requirementCollection = "core";
      const requirementNamespace = "kubernetes";
      const requirementVersion = "2.4.0";

      const filePath = path.join(customCollectionPath, "collections", "requirements.yml");
      const fileContent = ["---", "collections:", ` - name: ${requirementNamespace}.${requirementCollection}`, `   version: "${requirementVersion}"`];

      const directory = path.dirname(filePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      try {
        fs.writeFileSync(filePath, fileContent.join("\n"), "utf-8");
      } catch (e) {
        assert.fail(`Failed to create requirements.yml file before tests: ${e}`);
      }
    });

    after(() => {
      if (fs.existsSync(customCollectionPath)) {
        fs.rmSync(customCollectionPath, { recursive: true, force: true });
      }
    });

    it("Should validate the creation of a Playbook file", async () => {
      vscode.commands.executeCommand(VSCodeCommands.createFile, customPlaybookName, customCollectionPath);
      if (!fs.existsSync(path.join(customCollectionPath, customPlaybookName))) {
        assert.fail("Failed to create a custom Playbook file.");
      }
    });

    it("Should validate the creation of an Operator-Config file", async () => {
      vscode.commands.executeCommand(VSCodeCommands.createOperatorConfigBoilerplateFile, customCollectionURI);
      if (!fs.existsSync(path.join(customCollectionPath, "operator-config.yml"))) {
        assert.fail("Failed to create a custom Operator-Config file.");
      }
    });

    it("Should validate the creation of a Galaxy file", async () => {
      vscode.commands.executeCommand(VSCodeCommands.createGalaxyBoilerplateFile, customCollectionURI);
      if (!fs.existsSync(path.join(customCollectionPath, "galaxy.yml"))) {
        assert.fail("Failed to create a custom Galaxy file.");
      }
    });

    it("Should validate the conversion of a collection to an air-gapped collection.", async () => {
      try {
        const requirementsFilePath = path.join(customCollectionPath, "collections", "requirements.yml");

        if (fs.existsSync(requirementsFilePath)) {
          const requirement = workspace.getValuesFromYamlFile(requirementsFilePath, ["collections"])[0][0];
          const [requirementNamespace, requirementCollection] = requirement?.name.split(".");
          const requirementVersion = requirement?.version;
          const tarball = `${requirementNamespace}-${requirementCollection}-${requirementVersion}.tar.gz`;

          await vscode.commands.executeCommand(VSCodeCommands.convertToAirgapCollection, customCollectionURI, undefined, convertToAirgapCollectionLogPath);
          if (!fs.existsSync(path.join(customCollectionPath, "collections", tarball))) {
            assert.fail("Failed to download requirement when converting collection to an air-gapped collection.");
          }
        } else {
          assert.fail("Unable to detect to collections/requirements.yml file when converting collection to an air-gapped collection.");
        }
      } catch (e) {
        assert.fail(`Failed to convert collection to an air-gapped collection:$ ${e}`);
      }
    });

    it('Should validate the workspace "searchParents" function', () => {
      const targets = [/operator-config.ya?ml/];
      const workspaceRootFolderName = testVars.fixturePath.substring(0, testVars.fixturePath.lastIndexOf("/"));
      let returnedPath = workspace.searchParents(customCollectionPath, workspaceRootFolderName, targets);
      assert.equal("", returnedPath);

      returnedPath = workspace.searchParents(path.join(customCollectionPath, "collections"), workspaceRootFolderName, targets);
      assert.equal(path.join(customCollectionPath, "operator-config.yml"), returnedPath);
    });

    it('Should validate the workspace "findNearestCollectionInLineage" function', () => {
      let [returnedPath, pathIsAmbiguous] = workspace.findNearestCollectionInLineage(customCollectionPath);
      assert.equal(customCollectionPath, returnedPath);
      assert.equal(false, pathIsAmbiguous);

      const workspaceRootFolderName = testVars.fixturePath.substring(0, testVars.fixturePath.lastIndexOf("/"));
      [returnedPath, pathIsAmbiguous] = workspace.findNearestCollectionInLineage(path.join(customCollectionPath, "collections"), workspaceRootFolderName);
      assert.equal(customCollectionPath, returnedPath);
      assert.equal(false, pathIsAmbiguous);

      // test function on directory with multiple child collections
      [returnedPath, pathIsAmbiguous] = workspace.findNearestCollectionInLineage(testVars.fixturePath);
      assert.equal("", returnedPath);
      assert.equal(true, pathIsAmbiguous);
    });

    it('Should validate the workspace "findNearestFolderOrFile" function', () => {
      const target = /requirements.ya?ml/;
      const workspaceRootFolderName = testVars.fixturePath.substring(0, testVars.fixturePath.lastIndexOf("/"));
      let returnedPath = workspace.findNearestFolderOrFile([customCollectionPath], workspaceRootFolderName, target);
      assert.equal(path.join(customCollectionPath, "collections", "requirements.yml"), returnedPath);
    });

    it('Should validate the workspace "getMatchingDecendants" function', () => {
      let targets = [/requirements.ya?ml/];
      let returnedPaths = workspace.getMatchingDecendants(customCollectionPath, targets, false);
      assert.equal(returnedPaths.length, 0);

      returnedPaths = workspace.getMatchingDecendants(customCollectionPath, targets, true);
      assert.equal(returnedPaths.length, 1);
      assert.equal(path.join(customCollectionPath, "collections", "requirements.yml"), returnedPaths[0]);

      targets = [/requirements.ya?ml/, /operator-config.ya?ml/];
      returnedPaths = workspace.getMatchingDecendants(customCollectionPath, targets, true);
      assert.equal(returnedPaths.length, 2);
      assert.equal(true, returnedPaths.includes(path.join(customCollectionPath, "collections", "requirements.yml")));
      assert.equal(true, returnedPaths.includes(path.join(customCollectionPath, "operator-config.yml")));
    });

    it('Should validate the workspace "gatherDirectoryPlaybooks" function', async () => {
      let playbooks = await workspace.gatherDirectoryPlaybooks(customCollectionPath);
      assert.equal(playbooks.length, 1);
      assert.equal(playbooks[0], customPlaybookName);

      // playbooks = await workspace.gatherDirectoryPlaybooks(pseudoCollectionPath);
      // assert.equal(playbooks.length, 0);
    });
  });
});

async function installOperatorCollectionSDK(installSdkLogPath: string) {
  vscode.commands.executeCommand(VSCodeCommands.install, installSdkLogPath);
  await util.sleep(15000);
  try {
    child_process.execSync("ansible-galaxy collection list | grep ibm.operator_collection_sdk");
  } catch (e) {
    console.log("Printing Install OC SDK logs");
    helper.displayCmdOutput(installSdkLogPath);
    assert.equal(e, undefined);
    process.exit(1);
  }
}

async function getOperatorPodItems(parentOperator: OperatorItem): Promise<OperatorPodItem[]> {
  const operatorPodItems: Array<OperatorPodItem> = [];
  const k8s = new helper.TestKubernetesObj();
  const pods = await k8s.getOperatorPods(parentOperator.operatorName);
  if (pods) {
    for (const pod of pods) {
      const containerStatus = await k8s.getOperatorContainerStatuses(parentOperator.operatorName, pod);
      operatorPodItems.push(new OperatorPodItem(pod, containerStatus, parentOperator));
    }
  }
  return operatorPodItems;
}

async function getOperatorContainerItems(parentOperator: OperatorItem): Promise<OperatorContainerItem[]> {
  const operatorContainerItems: Array<OperatorContainerItem> = [];
  const k8s = new helper.TestKubernetesObj();
  const operatorPodItems = await getOperatorPodItems(parentOperator);
  if (operatorPodItems.length === 1) {
    const containerStatuses = await k8s.getOperatorContainerStatuses(operatorPodItems[0].parentOperator.operatorName, operatorPodItems[0].podObj);
    for (const containerStatus of containerStatuses) {
      operatorContainerItems.push(new OperatorContainerItem(operatorPodItems[0].podObj, containerStatus, operatorPodItems[0].parentOperator));
    }
  }
  return operatorContainerItems;
}
