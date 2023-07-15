// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OcSdkCommand } from './utilities/OCSDKCommands';
import { error } from 'console';
import * as path from 'path';


type WorkSpaceOperators = {[key: string] : string};

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(executeSdkCommandWithUserInput("operator-collection-sdk.createOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.deleteOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployCollection"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployOperator"));
}

/**
 * Executes a simple command without user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSimpleSdkCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		let pwd = getCurrentWorkspaceRootFolder();
		if (pwd === undefined) {
			vscode.window.showInformationMessage("Unable to execute command when workspace is empty");
		} else {
			let workspacePath = await selectOperatorInWorkspace(pwd).then((result) => {
				return result;
			});
			if (workspacePath !== undefined) {
				workspacePath = path.parse(workspacePath).dir;
				switch(command) {
					case "operator-collection-sdk.deleteOperator": {
						OcSdkCommand.runDeleteOperatorCommand(workspacePath).then(() => {
							vscode.window.showInformationMessage("Delete Operator command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Delete Operator command: RC ${e}`);
						});
						break;
					}
					case "operator-collection-sdk.deleteOperator": {
						OcSdkCommand.runRedeployCollectionCommand(workspacePath).then(() => {
							vscode.window.showInformationMessage("Redeploy Operator command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Redeploy Operator command: RC ${e}`);
						});
						break;
					}
					case "operator-collection-sdk.redeployCollection": {
						OcSdkCommand.runRedeployCollectionCommand(workspacePath).then(() => {
							vscode.window.showInformationMessage("Redeploy Collection command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Redeploy Collection command: RC ${e}`);
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
		if (pwd === undefined) {
			vscode.window.showInformationMessage("Unable to execute Create Operator command when workspace is empty");
		} else {
			let workspacePath = await selectOperatorInWorkspace(pwd).then((result) => {
				return result;
			});
			if (workspacePath === undefined) {
				vscode.window.showInformationMessage("Please select Operator in workspace to deploy");
			} else {
				switch(command) {
					case "operator-collection-sdk.createOperator": {
						let playbookArgs = await requestOperatorInfo().then((result) => {
							return result;
						});
						workspacePath = path.parse(workspacePath).dir;
						OcSdkCommand.runCreateOperatorCommand(playbookArgs, workspacePath).then(() => {
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
async function selectOperatorInWorkspace(workspace: vscode.WorkspaceFolder): Promise<string | undefined> {
	let operatorsInWorkspace = await getOperatorsInWorkspace(workspace);
	let operatorNames: Array<string> = [];
	let totalOperators: number = 0;
	for (const operatorName in operatorsInWorkspace) {
		totalOperators++;
		operatorNames.push(operatorName);
	}
	if (totalOperators > 1) {
		const operatorSelected = await vscode.window.showQuickPick(operatorNames, {
			canPickMany: false,
			ignoreFocusOut: true,
			placeHolder: "Select an Operator below",
			title: "Available Operators in workspace"
		}).then((result) => {
			return result;
		});
		if (operatorSelected === undefined) {
			return undefined;
		}
		return operatorsInWorkspace[operatorSelected];
	} else if (totalOperators === 1) {
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

	if (zosEndpointUsername === undefined) {
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

	if (zosEndpointSSHKey === undefined) {
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

	if (zosEndpointPassphrase === undefined ) {
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
    var editor = vscode.window.activeTextEditor;
	if (editor !== undefined) {
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

// This method is called when your extension is deactivated
export function deactivate() {}
