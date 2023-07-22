import * as vscode from 'vscode';
import * as util from "./utilities/util";
import * as path from 'path';
import { OcSdkCommand } from './commands/ocSdkCommands';
import {OperatorsTreeProvider} from './treeViews/providers/operatorProvider';
import {ResourcesTreeProvider} from './treeViews/providers/resourceProvider';
import {LinksTreeProvider} from './treeViews/providers/linkProvider';
import {OperatorContainerItem} from "./treeViews/operatorItems/operatorContainerItem";
import {ZosEndpointsItem} from "./treeViews/resourceItems/zosendpointsItem";
import {CustomResourceItem} from "./treeViews/resourceItems/customResourceItem";
import {LinkItem} from "./treeViews/linkItems/linkItem";
import {initResources} from './treeViews/icons';
import {KubernetesObj} from "./kubernetes/kubernetes";

import { OperatorItem } from './treeViews/operatorItems/operatorItem';
import { OperatorPodItem } from './treeViews/operatorItems/operatorPodItem';

export function activate(context: vscode.ExtensionContext) {
	initResources(context);
	const operatorTreeProvider = new OperatorsTreeProvider();
	const resourceTreeProvider = new ResourcesTreeProvider();
	const linksTreeProvider = new LinksTreeProvider();
	vscode.window.registerTreeDataProvider('operator-collection-sdk.operators', operatorTreeProvider);
	vscode.window.registerTreeDataProvider('operator-collection-sdk.resources', resourceTreeProvider);
	vscode.window.registerTreeDataProvider('operator-collection-sdk.links', linksTreeProvider);
	context.subscriptions.push(executeSdkCommandWithUserInput("operator-collection-sdk.createOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.deleteOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployCollection"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployOperator"));
	context.subscriptions.push(executeContainerLogDownloadCommand("operator-collection-sdk.downloadLogs"));
	context.subscriptions.push(executeContainerLogDownloadCommand("operator-collection-sdk.downloadVerboseLogs"));
	context.subscriptions.push(executeOpenLinkCommand("operator-collection-sdk.openEditLink"));
	context.subscriptions.push(executeOpenLinkCommand("operator-collection-sdk.openAddLink"));
	context.subscriptions.push(executeOpenLinkCommand("operator-collection-sdk.openLink"));
	context.subscriptions.push(vscode.commands.registerCommand("operator-collection-sdk.refresh", () => {
		operatorTreeProvider.refresh();
		resourceTreeProvider.refresh();
	}));
}

function executeOpenLinkCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (args: ZosEndpointsItem | CustomResourceItem | LinkItem) => {
		let linkUri = vscode.Uri.parse(args.link);
		let res = await vscode.env.openExternal(linkUri);
		if (!res) {
			vscode.window.showErrorMessage("Failure opening external link");
		}
	});
}

function executeContainerLogDownloadCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (containerItemArgs: OperatorContainerItem) => {
		const k8s = new KubernetesObj();
		const pwd = util.getCurrentWorkspaceRootFolder();
		if (!pwd) {
			vscode.window.showErrorMessage("Unable to execute command when workspace is empty");
		} else {
			let workspacePath = await util.selectOperatorInWorkspace(pwd, containerItemArgs.operatorName);
			if (!workspacePath) {
				vscode.window.showErrorMessage("Unable to locace valid operator collection in workspace");
			} else {
				workspacePath = path.parse(workspacePath).dir;
				switch(command) {
					case "operator-collection-sdk.downloadLogs": {
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
								vscode.window.showErrorMessage(`Unable to download log: ${e}`);
							}
						} else {
							vscode.window.showErrorMessage("Unable to download log");
						}
						break;
					}
					case "operator-collection-sdk.downloadVerboseLogs": {
						const apiVersion = await util.getConvertedApiVersion(workspacePath);
						const kind = await util.selectCustomResourceFromOperatorInWorkspace(workspacePath);
						let crInstance: string | undefined = "";
						if (apiVersion) {
							crInstance = await util.selectCustomResourceInstance(workspacePath, k8s, apiVersion, kind!);
							let logsPath: string | undefined = "";
							if (kind && crInstance) {
								logsPath = await k8s.downloadVerboseContainerLogs(containerItemArgs.podObj.metadata?.name!, containerItemArgs.containerStatus.name, workspacePath, apiVersion, kind, crInstance);
								if (logsPath) {
									try {
										const logUri: vscode.Uri = vscode.Uri.parse(logsPath);
										const textDocument = await vscode.workspace.openTextDocument(logUri);
										await vscode.window.showTextDocument(textDocument, {
											preview: false
										});
										vscode.window.showInformationMessage("Container logs downloaded successfully");
									} catch (e) {
										vscode.window.showErrorMessage(`Unable to download log: ${e}`);
									}
								} else {
									vscode.window.showErrorMessage("Unable to download log");
								}
							} else {
								vscode.window.showErrorMessage("Unable to download log due to undefined kind and/or custom resource instance");
							}
						} else {
							vscode.window.showErrorMessage("Unable to download log due to undefined version in operator-config");
						}
					}
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
		let pwd = util.getCurrentWorkspaceRootFolder();
		if (!pwd) {
			vscode.window.showErrorMessage("Unable to execute command when workspace is empty");
		} else {
			let workspacePath = await util.selectOperatorInWorkspace(pwd);
			if (workspacePath) {
				workspacePath = path.parse(workspacePath).dir;
				let ocSdkCommand = new OcSdkCommand(workspacePath);
				switch(command) {
					case "operator-collection-sdk.deleteOperator": {
						vscode.window.showInformationMessage("Delete Operator request in progress");
						const poll = util.pollRun(10);
						const runDeleteOperatorCommand = ocSdkCommand.runDeleteOperatorCommand();
						Promise.all([poll, runDeleteOperatorCommand]).then(() => {
							vscode.window.showInformationMessage("Delete Operator command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Delete Operator command: RC ${e}`);
						});
						break;
					}
					case "operator-collection-sdk.redeployCollection": {
						vscode.window.showInformationMessage("Redeploy Collection request in progress");
						const poll = util.pollRun(15);
						const runRedeployCollectionCommand = ocSdkCommand.runRedeployCollectionCommand();
						Promise.all([poll, runRedeployCollectionCommand]).then(() => {
							vscode.window.showInformationMessage("Redeploy Collection command executed successfully");
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Redeploy Collection command: RC ${e}`);
						});
						break;
					}
					case "operator-collection-sdk.redeployOperator": {
						vscode.window.showInformationMessage("Redeploy Operator request in progress");
						const poll = util.pollRun(25);
						const runRedeployOperatorCommand = ocSdkCommand.runRedeployOperatorCommand();
						Promise.all([poll, runRedeployOperatorCommand]).then(() => {
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
		let pwd = util.getCurrentWorkspaceRootFolder();
		if (!pwd) {
			vscode.window.showErrorMessage("Unable to execute Create Operator command when workspace is empty");
		} else {
			let workspacePath = await util.selectOperatorInWorkspace(pwd);
			if (!workspacePath) {
				vscode.window.showInformationMessage("Please select Operator in workspace to deploy");
			} else {
				if (command === "operator-collection-sdk.createOperator") {
					let playbookArgs = await util.requestOperatorInfo();
					if (playbookArgs) {
						workspacePath = path.parse(workspacePath).dir;
						let ocSdkCommand = new OcSdkCommand(workspacePath);
						vscode.window.showInformationMessage("Create Operator request in progress");
						const poll = util.pollRun(40);
						const runCreateOperatorCommand = ocSdkCommand.runCreateOperatorCommand(playbookArgs);
						Promise.all([poll, runCreateOperatorCommand]).then(() => {
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
