// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OcSdkCommand } from './utilities/OCSDKCommands';
import { error } from 'console';
import * as path from 'path';


type WorkSpaceOperators = {[key: string] : string};

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "operator-collection-sdk" is now active!');

	let createOperatorCommand = vscode.commands.registerCommand('operator-collection-sdk.createOperator', async () => {
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
				let playbookArgs = await requestOperatorInfo().then((result) => {
						return result;
				});
				workspacePath = path.parse(workspacePath).dir;
				OcSdkCommand.runCreateOperatorCommand(playbookArgs, workspacePath);
			};
		}
	});

	let deleteOperatorCommand = vscode.commands.registerCommand('operator-collection-sdk.deleteOperator', async () => {
		let pwd = getCurrentWorkspaceRootFolder();
		if (pwd === undefined) {
			vscode.window.showInformationMessage("Unable to execute Delete Operator command when workspace is empty");
		} else {
			let workspacePath = await selectOperatorInWorkspace(pwd).then((result) => {
				return result;
			});
			if (workspacePath === undefined) {
				vscode.window.showInformationMessage("Please select Operator in workspace to deploy");
			} else {
				workspacePath = path.parse(workspacePath).dir;
				OcSdkCommand.runDeleteOperatorCommand(workspacePath);
			}
		}
	});

	let redeployCollectionCommand = vscode.commands.registerCommand('operator-collection-sdk.redeployCollection', async () => {
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
				workspacePath = path.parse(workspacePath).dir;
				OcSdkCommand.runRedeployCollectionCommand(workspacePath);
			}
		}
	});

	context.subscriptions.push(createOperatorCommand);
	context.subscriptions.push(deleteOperatorCommand);
	context.subscriptions.push(redeployCollectionCommand);
}

async function selectOperatorInWorkspace(workspace: vscode.WorkspaceFolder): Promise<string | undefined> {
	let operatorsInWorkspace = await getOperatorsInWorkspace(workspace);
	let operatorNames: Array<string> = [];
	for (const operatorName in operatorsInWorkspace) {
		operatorNames.push(operatorName);
	}
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
}

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
		args.push(`-e "zosendpoint_username="`);
	} else {
		args.push(`-e "zosendpoint_username=${zosEndpointUsername}"`);
	}
	
	const zosEndpointSSHKey = await vscode.window.showInputBox({
		prompt: "Enter the path to your private SSH Key for this endpoint (Skip if the zoscb-encrypt CLI isn't installed)",
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});

	if (zosEndpointSSHKey === undefined) {
		args.push(`-e "zosendpoint_ssh_key="`);
	} else {
		args.push(`-e "zosendpoint_ssh_key=${zosEndpointSSHKey}"`);
	}
	

	const zosEndpointPassphrase = await vscode.window.showInputBox({
		prompt: "Enter the passphrase for the SSH Key for this endpoint (Skip if the zoscb-encrypt CLI isn't installed)",
		password: true,
		ignoreFocusOut: true
	}).then((result) => {
		return result;
	});

	if (zosEndpointPassphrase === undefined ) {
		args.push(`-e "zosendpoint_passphrase="`);
	} else {
		args.push(`-e "zosendpoint_passphrase=${zosEndpointPassphrase}"`);
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
 * @returns — An array list of Operator names in the current workspace
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
