// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OcSdkCommand } from './commands/ocSdkCommands';
import {OperatorsTreeProvider} from './treeViews/providers/operatorProvider';
import {ResourcesTreeProvider} from './treeViews/providers/resourceProvider';
import {OperatorContainerItem} from "./treeViews/operatorItems/operatorContainerItem";

import {initResources} from './treeViews/icons';
import {KubernetesObj} from "./kubernetes/kubernetes";
import * as path from 'path';


type WorkSpaceOperators = {[key: string] : string};

export function activate(context: vscode.ExtensionContext) {
	initResources(context);
	vscode.window.registerTreeDataProvider('operator-collection-sdk.operators', new OperatorsTreeProvider());
	vscode.window.registerTreeDataProvider('operator-collection-sdk.resources', new ResourcesTreeProvider());
	context.subscriptions.push(executeSdkCommandWithUserInput("operator-collection-sdk.createOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.deleteOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployCollection"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployOperator"));
	context.subscriptions.push(executeContainerLogDownloadCommand("operator-collection-sdk.downloadLogs"));
}

function executeContainerLogDownloadCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (containerItemArgs: OperatorContainerItem) => {
		const k8s = new KubernetesObj();
		const pwd = getCurrentWorkspaceRootFolder();
		if (!pwd) {
			vscode.window.showErrorMessage("Unable to execute command when workspace is empty");
		} else {
			let workspacePath = await selectOperatorInWorkspace(pwd!, containerItemArgs.operatorName);
			if (!workspacePath) {
				vscode.window.showErrorMessage("Unable to locace valid operator collection in workspace");
			} else {
				workspacePath = path.parse(workspacePath).dir;
				const logsPath = await k8s.downloadContainerLogs(containerItemArgs.podObj.metadata?.name!, containerItemArgs.containerStatus.name, workspacePath);
				if (logsPath) {
					try {
						const logUri: vscode.Uri = vscode.Uri.parse(logsPath);
						const textDocument = await vscode.workspace.openTextDocument(logUri);
						await vscode.window.showTextDocument(textDocument, {
							preview: false
						  });
						vscode.window.showInformationMessage("Container logs downloaded successfully");
					} catch (e) {
						vscode.window.showErrorMessage("Unable to download log");
					}
				} else {
					vscode.window.showErrorMessage("Unable to download log");
				}
				
			}
		}
		
		
	});
}

/**
 * Executes a simple command without user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSimpleSdkCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		let pwd = getCurrentWorkspaceRootFolder();
		if (!pwd) {
			vscode.window.showErrorMessage("Unable to execute command when workspace is empty");
		} else {
			let workspacePath = await selectOperatorInWorkspace(pwd);
			if (workspacePath) {
				workspacePath = path.parse(workspacePath).dir;
				let ocSdkCommand = new OcSdkCommand(workspacePath);
				switch(command) {
					case "operator-collection-sdk.deleteOperator": {
						vscode.window.showInformationMessage("Delete Operator request in progress");
						ocSdkCommand.runDeleteOperatorCommand().then(() => {
							vscode.window.showInformationMessage("Delete Operator command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Delete Operator command: RC ${e}`);
						});
						break;
					}
					case "operator-collection-sdk.redeployCollection": {
						vscode.window.showInformationMessage("Redeploy Collection request in progress");
						ocSdkCommand.runRedeployCollectionCommand().then(() => {
							vscode.window.showInformationMessage("Redeploy Collection command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Redeploy Collection command: RC ${e}`);
						});
						break;
					}
					case "operator-collection-sdk.redeployOperator": {
						vscode.window.showInformationMessage("Redeploy Operator request in progress");
						ocSdkCommand.runRedeployOperatorCommand().then(() => {
							vscode.window.showInformationMessage("Redeploy Operator command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Redeploy Operator command: RC ${e}`);
						});
						break;
					}
				}
			}
		}
	});
}

/**
 * Executes a command that requires user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSdkCommandWithUserInput(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		let pwd = getCurrentWorkspaceRootFolder();
		if (!pwd) {
			vscode.window.showErrorMessage("Unable to execute Create Operator command when workspace is empty");
		} else {
			let workspacePath = await selectOperatorInWorkspace(pwd);
			if (!workspacePath) {
				vscode.window.showInformationMessage("Please select Operator in workspace to deploy");
			} else {
				switch(command) {
					case "operator-collection-sdk.createOperator": {
						let playbookArgs = await requestOperatorInfo();
						workspacePath = path.parse(workspacePath).dir;
						let ocSdkCommand = new OcSdkCommand(workspacePath);
						vscode.window.showInformationMessage("Create Operator request in progress");
						ocSdkCommand.runCreateOperatorCommand(playbookArgs).then(() => {
							vscode.window.showInformationMessage("Create Operator command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Create Operator command: RC ${e}`);
						});
					}
				}
			};
		}
	});
}

/**
 * Select the Operator in the workspace to execute against (if multiple operators exist)
 * @param workspace - The directory to the workspace folder
 * @returns - A Promise containing the directory to the selected operator
 */
async function selectOperatorInWorkspace(workspace: vscode.WorkspaceFolder, operatorName?: string): Promise<string | undefined> {
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
		}).then((result) => {
			return result;
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
 * Prompts the user for the necessary info to create a new operator
 * @returns - A Promise containing the args to pass to the playbook command
 */
async function requestOperatorInfo(): Promise<string[]> {
	let args: Array<string> = [];
	const zosEndpointType = await vscode.window.showInputBox({
		prompt: "Enter what type (local/remote) of ZosEndpoint you want to create",
		value: 'remote',
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});
	
	args.push(`-e "zosendpoint_type=${zosEndpointType}"`);
	
	const zosEndpointName = await vscode.window.showInputBox({
		prompt: "Enter your ZosEndpoint name",
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});
	
	args.push(`-e "zosendpoint_name=${zosEndpointName}"`);

	const zosEndpointHost = await vscode.window.showInputBox({
		prompt: "Enter your ZosEndpoint host",
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});

	args.push(`-e "zosendpoint_host=${zosEndpointHost}"`);

	const zosEndpointPort = await vscode.window.showInputBox({
		prompt: "Enter your ZosEndpoint port",
		value: '22',
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});

	args.push(`-e "zosendpoint_port=${zosEndpointPort}"`);

	const zosEndpointUsername = await vscode.window.showInputBox({
		prompt: "Enter you SSH Username for this endpoint (Skip if the zoscb-encrypt CLI isn't installed)",
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});

	if (!zosEndpointUsername) {
		args.push(`-e "username="`);
	} else {
		args.push(`-e "username=${zosEndpointUsername}"`);
	}
	
	const zosEndpointSSHKey = await vscode.window.showInputBox({
		prompt: "Enter the path to your private SSH Key for this endpoint (Skip if the zoscb-encrypt CLI isn't installed)",
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});

	if (!zosEndpointSSHKey) {
		args.push(`-e "ssh_key="`);
	} else {
		args.push(`-e "ssh_key=${zosEndpointSSHKey}"`);
	}
	

	const zosEndpointPassphrase = await vscode.window.showInputBox({
		prompt: "Enter the passphrase for the SSH Key for this endpoint (Skip if the zoscb-encrypt CLI isn't installed)",
		password: true,
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});

	if (!zosEndpointPassphrase) {
		args.push(`-e "passphrase="`);
	} else {
		args.push(`-e "passphrase=${zosEndpointPassphrase}"`);
	}
	return args;
}

/**
 * Retrieve the current workspace root directory if it exists
 * @returns — The vscode.WorkspaceFolder interface, or undefined if a directory doesn't exists
 */
function getCurrentWorkspaceRootFolder(): vscode.WorkspaceFolder | undefined {
    let editor = vscode.window.activeTextEditor;
	if (editor) {
		const currentDocument = editor.document.uri;
		return vscode.workspace.getWorkspaceFolder(currentDocument);
	}
    return undefined;
}

/**
 * Retrieve the list of Operator Collection names and workspace directories in the current workspace
 * @returns — A promise containing the WorkSpaceOperators object
 */
async function getOperatorsInWorkspace(workspace: vscode.WorkspaceFolder): Promise<WorkSpaceOperators> {
	const wsOperators: WorkSpaceOperators = {};
	for (const file of await vscode.workspace.findFiles("**/operator-config.*ml")) {
		let data = await vscode.workspace.openTextDocument(file);
		let operatorName = data.getText().split("name: ")[1].split("\n")[0];
		wsOperators[operatorName] = file.fsPath;

	}
	return wsOperators;
}

/**
 * Retrieve the list of Operator Collection names in the current workspace
 * @returns — A promise containing the WorkSpaceOperators object
 */
async function getOperatorNamesInWorkspace(workspace: vscode.WorkspaceFolder): Promise<string[]> {
	let operatorsInWorkspace = await getOperatorsInWorkspace(workspace);
	let operatorNames: Array<string> = [];
	for (const operatorName in operatorsInWorkspace) {
		operatorNames.push(operatorName);
	}
	return operatorNames;
}

// This method is called when your extension is deactivated
export function deactivate() {}
