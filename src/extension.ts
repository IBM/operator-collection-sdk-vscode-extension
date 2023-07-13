// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { OcSdkCommand } from './utilities/OCSDKCommands';
import { error } from 'console';

export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "operator-collection-sdk" is now active!');

	let createOperatorCommand = vscode.commands.registerCommand('operator-collection-sdk.createOperator', () => {
		let pwd = getCurrentWorkspaceRootFolder();
		if (pwd === undefined) {
			vscode.window.showInformationMessage("Unable to execute Create Operator command when workspace is empty");
		} else {
			requestOperatorInfo().then((result) => {
				if (pwd !== undefined) {
					OcSdkCommand.runCreateOperatorCommand(result, pwd.uri.fsPath);
				}
			});
		}
	});

	let redeployCollectionCommand = vscode.commands.registerCommand('operator-collection-sdk.redeployCollection', () => {
		let pwd = getCurrentWorkspaceRootFolder();
		if (pwd === undefined) {
			vscode.window.showInformationMessage("Unable to execute Create Operator command when workspace is empty");
		} else {
			if (pwd !== undefined) {
				OcSdkCommand.runRedeployCollectionCommand(pwd.uri.fsPath);
			}
		}
	});

	context.subscriptions.push(createOperatorCommand);
}

async function requestOperatorInfo(): Promise<any[]> {
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

export function getCurrentWorkspaceRootFolder(){
    var editor = vscode.window.activeTextEditor;
	if (editor !== undefined) {
		const currentDocument = editor.document.uri;
		return vscode.workspace.getWorkspaceFolder(currentDocument);
	}
    return undefined;
}

// This method is called when your extension is deactivated
export function deactivate() {}
