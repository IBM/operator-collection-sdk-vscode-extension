import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from "fs";
import {setInterval} from "timers";
import {KubernetesObj} from "../kubernetes/kubernetes";
import {OperatorsTreeProvider} from "../treeViews/providers/operatorProvider";
import {ResourcesTreeProvider} from "../treeViews/providers/resourceProvider";
import {OperatorItem, getOperatorItems} from "../treeViews/operatorItems/operatorItem";
import {OperatorPodItem, getOperatorPodItems} from "../treeViews/operatorItems/operatorPodItem";

type WorkSpaceOperators = {[key: string] : string};

export enum Links {
	ocSpecification = 'https://github.com/IBM/operator-collection-sdk/blob/main/docs/spec.md',
	issues = 'https://github.com/IBM/operator-collection-sdk/issues',
	tutorial = 'https://github.com/IBM/operator-collection-sdk/blob/main/docs/tutorial.md',
}

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
        let  refactoredVersion: string = "";
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
			title: "Available Operators in workspace"
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

/**
 * Select the Custom Resource Operator in the workspace to execute against (if multiple operators exist)
 * @param workspace - The directory to the workspace folder
 * @returns - A Promise containing the directory to the selected operator
 */
export async function selectCustomResourceFromOperatorInWorkspace(pwd: string, operatorName?: string): Promise<string | undefined> {
	let kinds = await getKindsInOperatorConfig(pwd);
	if (kinds.length > 1) {
		const kindSelected = await vscode.window.showQuickPick(kinds, {
			canPickMany: false,
			ignoreFocusOut: true,
			placeHolder: "Select the Kind where the instance was created",
			title: "Kinds available for this operator"
		});
		if (!kindSelected) {
			return undefined;
		}
		return kindSelected;
	} else if (kinds.length === 1) {
		return kinds[0];
	} else {
		return undefined;
	}
}


/**
 * Select the Custom Resource Operator in the workspace to execute against (if multiple operators exist)
 * @param workspace - The directory to the workspace folder
 * @returns - A Promise containing the directory to the selected operator
 */
export async function selectCustomResourceInstance(pwd: string, k8s: KubernetesObj, apiVersion: string, kind: string): Promise<string | undefined> {
	let crInstanceNames = await k8s.listCustomResouceInstanceNames(apiVersion, kind);
	if (crInstanceNames.length > 1) {
		const instanceSelected = await vscode.window.showQuickPick(crInstanceNames, {
			canPickMany: false,
			ignoreFocusOut: true,
			placeHolder: "Select the instance logs to display",
			title: "List of instances in the current namespace"
		});
		if (!instanceSelected) {
			return undefined;
		}
		return instanceSelected;
	} else if (crInstanceNames.length === 1) {
		return crInstanceNames[0];
	} else {
		return undefined;
	}
}

/**
 * Prompts the user for the necessary info to create a new operator
 * @returns - A Promise containing the args to pass to the playbook command
 */
export async function requestOperatorInfo(): Promise<string[] | undefined > {
	let args: Array<string> = [];

	const options: Array<string> = ["remote", "local"];

	const zosEndpointType = await vscode.window.showQuickPick(options, {
		canPickMany: false,
		ignoreFocusOut: true,
		placeHolder: "Select an endpoint type below",
		title: "Select the endpoint type (local or remote)"
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
		ignoreFocusOut: true
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
		ignoreFocusOut: true
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
		value: '22',
		ignoreFocusOut: true
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
		ignoreFocusOut: true
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
		value: '~/.ssh/id_rsa',
		ignoreFocusOut: true
	});

	if (zosEndpointSSHKey === undefined) {
		return undefined;
	} else if (zosEndpointSSHKey === "") {
		args.push(`-e "ssh_key="`);
	} else {
		args.push(`-e "ssh_key=${zosEndpointSSHKey}"`);
	}
	

	const zosEndpointPassphrase = await vscode.window.showInputBox({
		prompt: "Enter the passphrase for the SSH Key for this endpoint (Press Enter to skip if the zoscb-encrypt CLI isn't installed)",
		password: true,
		ignoreFocusOut: true
	});

	if (zosEndpointPassphrase === undefined) {
		return undefined
	} else if (zosEndpointPassphrase === "") {
		args.push(`-e "passphrase="`);
	} else {
		args.push(`-e "passphrase=${zosEndpointPassphrase}"`);
	}
	return args;
}

export function validateOperatorConfig(document: vscode.TextDocument): boolean {
    const text = document.getText();
    if (text.includes("domain") && 
        text.includes("name") &&
        text.includes("version") &&
        text.includes("displayName") &&
        text.includes("resources") &&
        text.includes("description")
    ) {
        return true;
    } else {
        return false;
    }
}

export async function pollRun(attempts: number): Promise<void> {
	let i = 0;
	const interval = setInterval((): void => {
		vscode.commands.executeCommand("operator-collection-sdk.refresh");
		if (++i === attempts) {
			clearInterval(interval);
		}
	}, 5000);
}