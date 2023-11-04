/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { setInterval } from "timers";
import { KubernetesObj } from "../kubernetes/kubernetes";
import { VSCodeCommands } from "../utilities/commandConstants";
import { match } from "assert";
import { type } from "os";

type WorkSpaceOperators = { [key: string]: string };

export enum Links {
  ocSpecification = "https://github.com/IBM/operator-collection-sdk/blob/main/docs/spec.md",
  ocSDKIssues = "https://github.com/IBM/operator-collection-sdk/issues",
  vscodeExtensionIssues = "https://github.com/IBM/operator-collection-sdk-vscode-extension/issues",
  tutorial = "https://mediacenter.ibm.com/playlist/dedicated/1_6hssue17/1_lcap76s4",
}

export enum ZosCloudBrokerKinds {
  zosEndpoint = "ZosEndpoint",
  subOperatorConfig = "SubOperatorConfig",
  operatorCollection = "OperatorCollection",
}

export enum AnsibleGalaxySettings {
  ansibleGalaxyConnectivity = "ansibleGalaxyConnectivity",
  ansibleGalaxyURL = "ansibleGalaxyURL",
  ansibleGalaxyNamespace = "ansibleGalaxyNamespace",
}

export enum LinterSettings {
  lintingEnabled = "lintingEnabled",
}

export enum AnsibleGalaxySettingsDefaults {
  ansibleGalaxyURL = "https://galaxy.ansible.com",
  ansibleGalaxyNamespace = "ibm",
}

export const zosCloudBrokerGroup: string = "zoscb.ibm.com";
export const clusterServiceVersionGroup: string = "operators.coreos.com";
export const customResourceGroup: string = "suboperator.zoscb.ibm.com";
export const clusterServiceVersionApiVersion: string = "v1alpha1";
export const zosEndpointApiVersion: string = "v2beta2";
export const subOperatorConfigApiVersion: string = "v2beta2";
export const operatorCollectionApiVersion: string = "v2beta2";
export const zosCloudBrokerApiVersion: string = "v2beta1";

export const logScheme: string = "containerLogs";
export const verboseLogScheme: string = "verboseContainerLogs";
export const customResourceScheme: string = "customResource";

/**
 * Retrieve the current workspace root directory if it exists
 * @returns — The vscode.WorkspaceFolder interface, or undefined if a directory doesn't exists
 */
export function getCurrentWorkspaceRootFolder(): string | undefined {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders?.length > 0) {
    return vscode.workspace.workspaceFolders[0].uri.path;
  }
  return undefined;
}

/**
 * Retrieve the list of Operator Collection names and workspace directories in the current workspace
 * @returns — A promise containing the WorkSpaceOperators object
 */
export async function getOperatorsInWorkspace(workspace: string): Promise<WorkSpaceOperators> {
  const wsOperators: WorkSpaceOperators = {};
  for (const file of await vscode.workspace.findFiles("**/operator-config.*ml")) {
    let data = await vscode.workspace.openTextDocument(file);
    if (validateOperatorConfig(data)) {
      let operatorName = data.getText().split("name: ")[1].split("\n")[0];
      wsOperators[operatorName] = file.fsPath;
    }
  }
  return wsOperators;
}

/**
 * Returns the operator-config version
 * @param pwd - the current working directory
 * @returns - A Promise containing the operator-config version
 */
export async function getOperatorConfigVersion(pwd: string): Promise<string | undefined> {
  return await getOperatorConfigInfo(pwd, "version");
}

/**
 * Returns the operator csv name
 * @param pwd - the current working directory
 * @returns - A Promise containing the operator csv name
 */
export async function getOperatorCSVName(pwd: string): Promise<string | undefined> {
  const domain = await getOperatorConfigInfo(pwd, "domain");
  const name = await getOperatorConfigInfo(pwd, "name");
  const version = await getOperatorConfigInfo(pwd, "version");
  if (domain && name && version) {
    return `${domain.toLowerCase()}-${name.toLowerCase()}-operator.v${version}`;
  } else {
    return undefined;
  }
}

async function getOperatorConfigInfo(pwd: string, fieldName: string): Promise<string | undefined> {
  const operatorConfigUri = getOperatorConfigUri(pwd);
  let data = await vscode.workspace.openTextDocument(operatorConfigUri);
  if (validateOperatorConfig(data)) {
    let value = data.getText().split(`${fieldName}: `)[1].split("\n")[0];
    return value;
  }
  return undefined;
}

/**
 * Returns the converted API version in the kubernetes format
 * @param pwd - the current working directory
 * @returns - A Promise containing the converted API version
 */
export async function getConvertedApiVersion(pwd: string): Promise<string | undefined> {
  const version = await getOperatorConfigVersion(pwd);
  if (version) {
    let versionSplit = version.split(".");
    let refactoredVersion: string = "";
    if (versionSplit.length === 3) {
      refactoredVersion = `v${versionSplit[0]}minor${versionSplit[1]}patch${versionSplit[2]}`;
    } else if (versionSplit.length === 4) {
      refactoredVersion = `v${versionSplit[0]}minor${versionSplit[1]}patch${versionSplit[2]}-${versionSplit[3]}`;
    }

    return refactoredVersion;
  } else {
    return undefined;
  }
}

/**
 * Retrieve the list of Kinds in the operator-config.yml file in the workspace
 * @returns — A promise containing the WorkSpaceOperators object
 */
export async function getKindsInOperatorConfig(pwd: string): Promise<string[]> {
  let kindNames: Array<string> = [];
  const operatorConfigUri = getOperatorConfigUri(pwd);
  let data = await vscode.workspace.openTextDocument(operatorConfigUri);
  if (validateOperatorConfig(data)) {
    kindNames = data.getText().split("kind: ").slice(1);
    for (let i = 0; i < kindNames.length; i++) {
      kindNames[i] = kindNames[i].split("\n")[0];
    }
  }
  return kindNames;
}

function getOperatorConfigUri(pwd: string): vscode.Uri {
  let operatorConfigFilePath: string = "";
  if (fs.existsSync(path.join(pwd, "operator-config.yml"))) {
    operatorConfigFilePath = path.join(pwd, "operator-config.yml");
  } else if (fs.existsSync(path.join(pwd, "operator-config.yaml"))) {
    operatorConfigFilePath = path.join(pwd, "operator-config.yaml");
  } else {
    vscode.window.showErrorMessage("operator-config file doesn't exist in workspace");
  }
  return vscode.Uri.parse(operatorConfigFilePath);
}

/**
 * Retrieve the list of Operator Collection names in the current workspace
 * @returns — A promise containing the WorkSpaceOperators object
 */
export async function getOperatorNamesInWorkspace(workspace: string): Promise<string[]> {
  let operatorsInWorkspace = await getOperatorsInWorkspace(workspace);
  let operatorNames: Array<string> = [];
  for (const operatorName in operatorsInWorkspace) {
    operatorNames.push(operatorName);
  }
  return operatorNames;
}

/**
 * Select the Operator in the workspace to execute against (if multiple operators exist)
 * @param workspace - The directory to the workspace folder
 * @returns - A Promise containing the directory to the selected operator
 */
export async function selectOperatorInWorkspace(workspace: string, operatorName?: string): Promise<string | undefined> {
  let operatorsInWorkspace = await getOperatorsInWorkspace(workspace);
  if (operatorName) {
    return operatorsInWorkspace[operatorName];
  }
  let operatorNames = await getOperatorNamesInWorkspace(workspace);
  if (operatorNames.length > 1) {
    const operatorSelected = await vscode.window.showQuickPick(operatorNames, {
      canPickMany: false,
      ignoreFocusOut: true,
      placeHolder: "Select an Operator below",
      title: "Available Operators in workspace",
    });
    if (!operatorSelected) {
      return undefined;
    }
    return operatorsInWorkspace[operatorSelected];
  } else if (operatorNames.length === 1) {
    return operatorsInWorkspace[operatorNames[0]];
  } else {
    return undefined;
  }
}

interface OperatorVariables {
  zosendpoint_type: string;
  zosendpoint_name: string;
  zosendpoint_host: string;
  zosendpoint_port: string;
  username: string;
  ssh_key: string;
  passphrase?: string;
}

/**
 * Prompts the user for the necessary info to create a new operator
 * @returns - A Promise containing the list of parameters to pass to the command
 */
export async function requestOperatorInfo(workspacePath: string): Promise<string[] | undefined> {
  let args: Array<string> = [];
  const yesNoOptions: Array<string> = ["Yes", "No"];
  const filePattern = new vscode.RelativePattern(workspacePath, "ocsdk-extra-vars.*ml");
  const ocsdkVarsFile = await vscode.workspace.findFiles(filePattern);
  let extraVarsFilePath: string = "";
  if (ocsdkVarsFile.length === 1) {
    extraVarsFilePath = ocsdkVarsFile[0].fsPath;
    const operatorConfigData = fs.readFileSync(extraVarsFilePath);
    const operatorVars = yaml.load(operatorConfigData.toString()) as OperatorVariables;

    if (operatorVars.passphrase === undefined) {
      const passphrase = await promptForPassphrase();

      if (passphrase) {
        args.push(`-e "passphrase=${passphrase}"`);
      } else if (passphrase === "") {
        args.push(`-e "passphrase="`);
        const bypassPassphrase = await vscode.window.showQuickPick(yesNoOptions, {
          canPickMany: false,
          ignoreFocusOut: true,
          placeHolder: "Bypass passphrase prompts?",
          title: "Would you like to bypass passphrase prompts later?",
        });
        if (bypassPassphrase?.toLowerCase() === "yes") {
          operatorVars.passphrase = "";
          const operatorVarsStringData = JSON.stringify(operatorVars);
          const updatedVarsYaml = yaml.dump(JSON.parse(operatorVarsStringData));
          try {
            fs.writeFileSync(extraVarsFilePath, updatedVarsYaml);
          } catch (e) {
            console.error("Failure storing variables to file");
          }
        }
      }
    }
    args.push(`--extra-vars "@${extraVarsFilePath}"`);
    return args;
  } else if (ocsdkVarsFile.length > 1) {
    vscode.window.showErrorMessage("Multiple ocsdk-extra-vars files in Operator Collection not allowed");
    return undefined;
  }

  const options: Array<string> = ["remote", "local"];

  const zosEndpointType = await vscode.window.showQuickPick(options, {
    canPickMany: false,
    ignoreFocusOut: true,
    placeHolder: "Select an endpoint type below",
    title: "Select the endpoint type (local or remote)",
  });

  if (zosEndpointType === undefined) {
    return undefined;
  } else if (zosEndpointType === "") {
    vscode.window.showErrorMessage("Endpoint type is required");
    return undefined;
  }
  args.push(`-e "zosendpoint_type=${zosEndpointType}"`);

  const zosEndpointName = await vscode.window.showInputBox({
    prompt: "Enter your ZosEndpoint name",
    ignoreFocusOut: true,
  });

  if (zosEndpointName === undefined) {
    return undefined;
  } else if (zosEndpointName === "") {
    vscode.window.showErrorMessage("ZosEndpoint Name is required");
    return undefined;
  }

  args.push(`-e "zosendpoint_name=${zosEndpointName}"`);

  const zosEndpointHost = await vscode.window.showInputBox({
    prompt: "Enter your ZosEndpoint host",
    ignoreFocusOut: true,
  });

  if (zosEndpointHost === undefined) {
    return undefined;
  } else if (zosEndpointHost === "") {
    vscode.window.showErrorMessage("ZosEndpoint host is required");
    return undefined;
  }

  args.push(`-e "zosendpoint_host=${zosEndpointHost}"`);

  const zosEndpointPort = await vscode.window.showInputBox({
    prompt: "Enter your ZosEndpoint port",
    value: "22",
    ignoreFocusOut: true,
  });

  if (zosEndpointPort === undefined) {
    return undefined;
  } else if (zosEndpointPort === "") {
    vscode.window.showErrorMessage("ZosEndpoint port is required");
    return undefined;
  }

  args.push(`-e "zosendpoint_port=${zosEndpointPort}"`);

  const zosEndpointUsername = await vscode.window.showInputBox({
    prompt: "Enter you SSH Username for this endpoint (Press Enter to skip if the zoscb-encrypt CLI isn't installed)",
    ignoreFocusOut: true,
  });

  if (zosEndpointUsername === undefined) {
    return undefined;
  } else if (zosEndpointUsername === "") {
    args.push(`-e "username="`);
  } else {
    args.push(`-e "username=${zosEndpointUsername}"`);
  }

  const zosEndpointSSHKey = await vscode.window.showInputBox({
    prompt: "Enter the path to your private SSH Key for this endpoint (Press Enter to skip if the zoscb-encrypt CLI isn't installed)",
    value: "~/.ssh/id_ed25519",
    ignoreFocusOut: true,
  });

  if (zosEndpointSSHKey === undefined) {
    return undefined;
  } else if (zosEndpointSSHKey === "") {
    args.push(`-e "ssh_key="`);
  } else {
    args.push(`-e "ssh_key=${zosEndpointSSHKey}"`);
  }

  const zosEndpointPassphrase = await promptForPassphrase();

  if (zosEndpointPassphrase === undefined) {
    return undefined;
  } else if (zosEndpointPassphrase === "") {
    args.push(`-e "passphrase="`);
  } else {
    args.push(`-e "passphrase=${zosEndpointPassphrase}"`);
  }

  const saveToFile = await vscode.window.showQuickPick(yesNoOptions, {
    canPickMany: false,
    ignoreFocusOut: true,
    placeHolder: "Store variables to file?",
    title: "Would you like to store these variables to a file to bypass prompts later?",
  });

  if (saveToFile === undefined) {
    return undefined;
  }

  let operatorVariables: OperatorVariables = {
    zosendpoint_type: zosEndpointType,
    zosendpoint_name: zosEndpointName,
    zosendpoint_host: zosEndpointHost,
    zosendpoint_port: zosEndpointPort,
    username: zosEndpointUsername,
    ssh_key: zosEndpointSSHKey,
  };
  if (saveToFile.toLowerCase() === "yes") {
    extraVarsFilePath = path.join(workspacePath, "ocsdk-extra-vars.yml");
    if (zosEndpointPassphrase === "") {
      // only store passphrase variable if it's empty
      operatorVariables.passphrase = "";
    }

    const stringData = JSON.stringify(operatorVariables, null, 2);
    const varsYaml = yaml.dump(JSON.parse(stringData));
    try {
      fs.writeFileSync(extraVarsFilePath, varsYaml);
    } catch (e) {
      console.error("Failure storing variables to file");
    }
  }
  return args;
}

async function promptForPassphrase(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    prompt: "Enter the passphrase for the SSH Key for this endpoint (Press Enter to skip if the zoscb-encrypt CLI isn't installed)",
    password: true,
    ignoreFocusOut: true,
  });
}

export async function generateProjectDropDown(nslist?: Array<string>): Promise<string | undefined> {
  const args: Array<string> = [];
  const k8s = new KubernetesObj();
  const namespaceList = nslist ? nslist : await k8s.getNamespaceList();
  if (namespaceList) {
    const namespaceSelection = await vscode.window.showQuickPick(namespaceList, {
      canPickMany: false,
      ignoreFocusOut: true,
      placeHolder: "Select a Project",
      title: "Update the current Project",
    });

    if (!namespaceSelection) {
      return undefined;
    }
    return namespaceSelection;
  } else {
    return undefined;
  }
}

/**
 * Prompts the user for the necessary info to log in to an OpenShift cluster
 * @returns - A Promise containing the list of parameters to pass to the command
 */
export async function requestLogInInfo(): Promise<string[] | undefined> {
  let args: Array<string> = [];

  const inputArgs = await vscode.window.showInputBox({
    prompt: `Enter your oc login command: oc login --server=SERVER_URL --token=AUTH_TOKEN`,
    ignoreFocusOut: true,
    validateInput: text => {
      const ocLoginArgs = text.trimStart();

      // validate arguments
      const validRegex: { [key: string]: RegExp } = {
        "OC Command": /^(oc login)/gm,
        "Auth Token": /(--token=sha256~[A-Za-z0-9]+)/gm,
        "Server URL": /(--server=[A-Za-z0-9-\\\/\._~:\?\#\[\]@!\$&'\(\)\*\+,:;%=]+)/gm,
      };

      for (const rx in validRegex) {
        const failedRegex = !validRegex[rx].test(ocLoginArgs);
        if (failedRegex) {
          return "Format: oc login --server=SERVER_URL --token=AUTH_TOKEN (optionally --insecure-skip-tls-verify)";
        }
      }

      return null;
    },
  });

  if (inputArgs) {
    args = inputArgs
      .trimStart()
      .split(" ")
      ?.filter(item => {
        return item.length;
      })
      ?.slice(2);

    return args;
  } else {
    return undefined;
  }
}

export function validateOperatorConfig(document: vscode.TextDocument): boolean {
  const text = document.getText();
  if (text.includes("domain") && text.includes("name") && text.includes("version") && text.includes("displayName") && text.includes("resources") && text.includes("description")) {
    return true;
  } else {
    return false;
  }
}

export async function pollRun(attempts: number): Promise<void> {
  let i = 0;
  const interval = setInterval((): void => {
    vscode.commands.executeCommand(VSCodeCommands.refreshAll);
    if (++i === attempts) {
      clearInterval(interval);
    }
  }, 5000);
}

export function buildContainerLogUri(podName: string, containerName: string): vscode.Uri {
  return vscode.Uri.parse(`${logScheme}://${podName}/${containerName}`);
}

export function buildVerboseContainerLogUri(podName: string, containerName: string, apiVersion: string, kind: string, instanceName: string): vscode.Uri {
  return vscode.Uri.parse(`${verboseLogScheme}://${podName}/${containerName}/${apiVersion}/${kind}/${instanceName}`);
}

export function buildCustomResourceUri(kind: string, instanceName: string, group: string, apiVersion: string): vscode.Uri {
  return vscode.Uri.parse(`${customResourceScheme}://${kind}/${group}/${apiVersion}/${instanceName}`);
}

export function parseContainerLogUri(uri: vscode.Uri): {
  podName: string;
  containerName: string;
} {
  if (uri.scheme !== logScheme) {
    throw new Error("Uri is not of the containerLog scheme");
  }

  const uriSplitArray = uri.path.split("/");
  return {
    podName: uri.authority,
    containerName: uriSplitArray[1],
  };
}

export function parseVerboseContainerLogUri(uri: vscode.Uri): {
  podName: string;
  containerName: string;
  apiVersion: string;
  kind: string;
  instanceName: string;
} {
  if (uri.scheme !== verboseLogScheme) {
    throw new Error("Uri is not of the verboseContainerLog scheme");
  }

  const uriSplitArray = uri.path.split("/");
  return {
    podName: uri.authority,
    containerName: uriSplitArray[1],
    apiVersion: uriSplitArray[2],
    kind: uriSplitArray[3],
    instanceName: uriSplitArray[4],
  };
}

export function parseCustomResourceUri(uri: vscode.Uri): {
  kind: string;
  group: string;
  apiVersion: string;
  instanceName: string;
} {
  if (uri.scheme !== customResourceScheme) {
    throw new Error("Uri is not of the customResource scheme");
  }

  const uriSplitArray = uri.path.split("/");
  return {
    kind: uri.authority,
    group: uriSplitArray[1],
    apiVersion: uriSplitArray[2],
    instanceName: uriSplitArray[3],
  };
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function getAnsibleGalaxySettings(property: string): any {
  const configuration = vscode.workspace.getConfiguration("operatorCollectionSdk.ansibleGalaxy");
  const setting = configuration.get(property);
  if (setting instanceof String && setting === "") {
    switch (property) {
      case AnsibleGalaxySettings.ansibleGalaxyNamespace: {
        return AnsibleGalaxySettingsDefaults.ansibleGalaxyNamespace;
      }
      case AnsibleGalaxySettings.ansibleGalaxyURL: {
        return AnsibleGalaxySettingsDefaults.ansibleGalaxyURL;
      }
    }
  } else {
    return setting;
  }
}

export function getLinterSettings(property: string): any {
  const configuration = vscode.workspace.getConfiguration("operatorCollectionSdk.linter");
  return configuration.get(property);
}

export function getDirectoryContent(directory: string, recurse: boolean = false, fileExtensions: string[] = []): [string[], string[]] {
  const directoryContent = fs.readdirSync(directory, {
    withFileTypes: true,
    recursive: true,
  });

  const files: string[] = [];
  const directories: string[] = [];
  for (let i = 0; i < directoryContent.length; i++) {
    const item = path.join(directory, directoryContent[i].name);
    if (fs.lstatSync(item).isDirectory()) {
      directories.push(item);
    } else {
      if (fileExtensions.length) {
        if (fileExtensions.some(extension => item.includes(extension))) {
          files.push(item);
        }
      } else {
        files.push(item);
      }
    }
  }

  if (recurse && directories.length) {
    const subdirectoryContent = directories.map(subdirectory => {
      return getDirectoryContent(subdirectory, recurse, fileExtensions);
    });

    for (let i = 0; i < subdirectoryContent.length; i++) {
      const [f, d] = subdirectoryContent[i];
      files.push.apply(files, f); // extend array
      directories.push.apply(directories, d); // extend array
    }
  }

  return [files, directories];
}

export function findNearestFolderOrFile(queue: string[], workspaceRootFolderName: string, target: string | RegExp, visited: string[] = []): string | undefined {
  try {
    if (queue.length === 0) {
      return "";
    }

    const [files, directories] = getDirectoryContent(queue[0]);
    visited.push(queue[0]);

    // if we find the target in this directory, return target
    const targetRegex = typeof target === "string" ? new RegExp(`${target}\$`, "gm") : target;
    const filesMatching = files.filter(file => targetRegex.test(file));
    if (filesMatching.length) {
      return filesMatching[0];
    }
    const dirsMatching = directories.filter(dir => targetRegex.test(dir));
    if (dirsMatching.length) {
      return dirsMatching[0];
    }

    // otherwise keep searching recursively
    for (let i = 0; i < directories.length; i++) {
      if (!visited.includes(directories[i])) {
        queue.push(directories[i]);
      }
    }
    const parentDirectory = queue[0].substring(0, queue[0].lastIndexOf("/"));
    if (parentDirectory.includes(workspaceRootFolderName) && !visited.includes(parentDirectory)) {
      queue.push(parentDirectory);
    }

    return findNearestFolderOrFile(queue.slice(1), workspaceRootFolderName, target, visited);
  } catch (e) {
    console.log(`Recursion Error: ${e}`);
  }
}

export function pruneDirectoryStem(stem: string, items: string[]) {
  const re = new RegExp(`^${stem}/`, "gm");
  return items.map(item => item.replace(re, ""));
}

// Jaro String Similarity Algorithm
export function calcuateStringSimilarty(s1: string, s2: string) {
  if (s1 === s2) {
    return 1.0;
  }

  const mask1 = new Array(s1.length).fill(0);
  const mask2 = new Array(s2.length).fill(0);
  const matchDistance = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;

  // calculate matches (characters which match within a specified distance)
  for (let i = 0; i < s1.length; i++) {
    for (let j = 0; j < s2.length; j++) {
      let l = i;
      let r = i;
      for (let m = 0; m <= matchDistance; m++) {
        if (s2[l] === s1[i] || s2[r] === s1[i]) {
          mask1[i] = 1;
          mask2[j] = 1;
        }
        l = Math.max(0, l - m);
        r = Math.min(s2.length, r + m);
      }
    }
  }

  // distance is bidirectional so the value will be the same for both masks
  const matches = mask1.reduce((acc, currVal) => acc + currVal, 0);
  if (matches === 0) {
    return 0;
  }

  // calculate transpositions (# of non matching characters per index)
  let nonMatching = 0;
  const matches1 = s1.split("").filter((_, index) => mask1[index]);
  const matches2 = s2.split("").filter((_, index) => mask2[index]);
  for (let i = 0; i < matches1.length; i++) {
    if (matches1[i] !== matches2[i]) {
      nonMatching++;
    }
  }
  const transpositions = nonMatching / 2;

  // calulate similarity score
  const similarity = (1 / 3) * (matches / s1.length + matches / s2.length + (matches - transpositions) / matches);

  return similarity;
}
