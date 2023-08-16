/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import * as util from "./utilities/util";
import * as path from 'path';
import {VSCodeCommands, VSCodeViewIds} from './utilities/commandConstants';
import {OperatorsTreeProvider} from './treeViews/providers/operatorProvider';
import {OperatorItem} from './treeViews/operatorItems/operatorItem';
import {ResourcesTreeProvider} from './treeViews/providers/resourceProvider';
import {OpenShiftTreeProvider} from './treeViews/providers/openshiftProvider';
import {LinksTreeProvider} from './treeViews/providers/linkProvider';
import {OperatorContainerItem} from "./treeViews/operatorItems/operatorContainerItem";
import {ZosEndpointsItem} from "./treeViews/resourceItems/zosendpointsItem";
import {CustomResourceItem} from "./treeViews/resourceItems/customResourceItem";
import {CustomResourcesItem} from "./treeViews/resourceItems/customResourcesItem";
import {LinkItem} from "./treeViews/linkItems/linkItem";
import {initResources} from './treeViews/icons';
import {KubernetesObj} from "./kubernetes/kubernetes";
import {OcCommand} from "./shellCommands/ocCommand";
import {OcSdkCommand} from './shellCommands/ocSdkCommands';
import {Session} from "./utilities/session";

export async function activate(context: vscode.ExtensionContext) {
	initResources(context);

	const k8s = new KubernetesObj();
	const ocSdkCmd = new OcSdkCommand();
	const ocCmd = new OcCommand();
	const session = new Session();

	const isOcSDKinstalled = await session.validateOcSDKInstallation();
	const userLoggedIntoOCP = await session.validateOpenShiftAccess();
	const outputChannel = vscode.window.createOutputChannel('IBM Operator Collection SDK');



	const operatorTreeProvider = new OperatorsTreeProvider(session);
	const resourceTreeProvider = new ResourcesTreeProvider(session);
	const openshiftTreeProvider = new OpenShiftTreeProvider(session);
	const linksTreeProvider = new LinksTreeProvider();

	// Register Providers
	vscode.window.registerTreeDataProvider(VSCodeViewIds.operators, operatorTreeProvider);
	vscode.window.registerTreeDataProvider(VSCodeViewIds.resources, resourceTreeProvider);
	vscode.window.registerTreeDataProvider(VSCodeViewIds.help, linksTreeProvider);
	vscode.window.registerTreeDataProvider(VSCodeViewIds.openshiftClusterInfo, openshiftTreeProvider);

	
	// Register Comands
	vscode.commands.executeCommand("setContext", VSCodeCommands.sdkInstalled, isOcSDKinstalled);
	vscode.commands.executeCommand("setContext", VSCodeCommands.loggedIn, userLoggedIntoOCP);
	context.subscriptions.push(logIn(VSCodeCommands.login, ocCmd, session));
	context.subscriptions.push(installOcSdk(VSCodeCommands.install, ocSdkCmd, session, outputChannel));
	context.subscriptions.push(updateProject(VSCodeCommands.updateProject, ocCmd));
	context.subscriptions.push(executeSdkCommandWithUserInput(VSCodeCommands.createOperator, outputChannel));
	context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.deleteOperator, outputChannel));
	context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.redeployCollection, outputChannel));
	context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.redeployOperator, outputChannel));
	context.subscriptions.push(deleteCustomResource(VSCodeCommands.deleteCustomResource, k8s));
	context.subscriptions.push(executeContainerLogDownloadCommand(VSCodeCommands.downloadLogs, k8s));
	context.subscriptions.push(executeContainerLogDownloadCommand(VSCodeCommands.downloadVerboseLogs, k8s));
	context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openEditLink));
	context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openAddLink));
	context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openLink));
	context.subscriptions.push(vscode.commands.registerCommand(VSCodeCommands.refresh, () => {
		operatorTreeProvider.refresh();
		resourceTreeProvider.refresh();
	}));
	context.subscriptions.push(vscode.commands.registerCommand(VSCodeCommands.resourceRefresh, () => {
		resourceTreeProvider.refresh();
	}));
	context.subscriptions.push(vscode.commands.registerCommand(VSCodeCommands.refreshAll, () => {
		openshiftTreeProvider.refresh();
		operatorTreeProvider.refresh();
		resourceTreeProvider.refresh();
	}));
}

function installOcSdk(command: string, ocSdkCmd: OcSdkCommand, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		try {
			await ocSdkCmd.runCollectionVerifyCommand();
			session.ocSdkInstalled = true;
		} catch(e) {
			session.ocSdkInstalled = false;
		}
		if (session.ocSdkInstalled) {
			vscode.window.showInformationMessage("IBM Operator Collection SDK already installed");
			vscode.commands.executeCommand(VSCodeCommands.refresh);
		} else {
			outputChannel?.show();
			vscode.window.showInformationMessage("Installing the IBM Operator Collection SDK");
			ocSdkCmd.installOcSDKCommand(outputChannel).then(()=> {
				session.ocSdkInstalled = true;
				vscode.window.showInformationMessage("Successfully installed the IBM Operator Collection SDK");
				vscode.commands.executeCommand(VSCodeCommands.login);
				vscode.commands.executeCommand(VSCodeCommands.refresh);
			}).catch((e) => {
				vscode.window.showErrorMessage(`Failure installing the IBM Operator Collection SDK: ${e}`);
			});
		}
	});
}

function updateProject(command: string, ocCmd: OcCommand): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (namespaceArg?: string) => {
		let namespace: string | undefined;
		if (namespaceArg) {
			namespace = namespaceArg;
		} else {
			namespace = await util.generateProjectDropDown();
		}
		if (namespace) {
			ocCmd.runOcProjectCommand(namespace).then(() => {
				vscode.window.showInformationMessage("Successfully updating Project on OpenShift cluster");
				vscode.commands.executeCommand(VSCodeCommands.refreshAll);
			}).catch((e) => {
				vscode.window.showErrorMessage(`Failure updating Project on OpenShift cluster: ${e}`);
			});
		}
	});
}

function logIn(command: string, ocCmd: OcCommand, session: Session): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (params?: string[]) => {
		let args: string[] | undefined = [];
		if (params === undefined || params?.length === 0) {
			args = await util.requestLogInInfo();
		} else {
			args = params;
		}
		if (args) {
			ocCmd.runOcLoginCommand(args).then(() => {
				session.loggedIntoOpenShift = true;
				vscode.window.showInformationMessage("Successfully logged into OpenShift cluster");
				vscode.commands.executeCommand(VSCodeCommands.refreshAll);
			}).catch(() => {
				session.loggedIntoOpenShift = false;
				vscode.window.showErrorMessage(`Failure logging into OpenShift cluster`);
			});
		}
	});
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

function executeContainerLogDownloadCommand(command: string, k8s: KubernetesObj): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (containerItemArgs: OperatorContainerItem) => {
		const pwd = util.getCurrentWorkspaceRootFolder();
		if (!pwd) {
			vscode.window.showErrorMessage("Unable to execute command when workspace is empty");
		} else {
			let workspacePath = await util.selectOperatorInWorkspace(pwd, containerItemArgs.parentOperator.operatorName);
			if (!workspacePath) {
				vscode.window.showErrorMessage("Unable to locace valid operator collection in workspace");
			} else {
				workspacePath = path.parse(workspacePath).dir;
				switch(command) {
					case VSCodeCommands.downloadLogs: {
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
					case VSCodeCommands.downloadVerboseLogs: {
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
function executeSimpleSdkCommand(command: string, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (operatorItemArg: OperatorItem) => {
		let workspacePath: string | undefined = "";
		if (operatorItemArg) {
			workspacePath = operatorItemArg.workspacePath;
		} else {
			let pwd = util.getCurrentWorkspaceRootFolder();
			if (pwd) {
				workspacePath = await util.selectOperatorInWorkspace(pwd);
				workspacePath = path.parse(workspacePath!).dir;
			}
		}
		if (workspacePath) {
			let ocSdkCommand = new OcSdkCommand(workspacePath);
			outputChannel?.show();
			switch(command) {
				case VSCodeCommands.deleteOperator: {
					vscode.window.showInformationMessage("Delete Operator request in progress");
					const poll = util.pollRun(10);
					const runDeleteOperatorCommand = ocSdkCommand.runDeleteOperatorCommand(outputChannel);
					Promise.all([poll, runDeleteOperatorCommand]).then(() => {
						vscode.window.showInformationMessage("Delete Operator command executed successfully");
						vscode.commands.executeCommand(VSCodeCommands.refresh);
					}).catch((e) => {
						vscode.window.showInformationMessage(`Failure executing Delete Operator command: RC ${e}`);
					});
					break;
				}
				case VSCodeCommands.redeployCollection: {
					vscode.window.showInformationMessage("Redeploy Collection request in progress");
					const poll = util.pollRun(30);
					const runRedeployCollectionCommand = ocSdkCommand.runRedeployCollectionCommand(outputChannel);
					Promise.all([poll, runRedeployCollectionCommand]).then(() => {
						vscode.window.showInformationMessage("Redeploy Collection command executed successfully");
						vscode.commands.executeCommand(VSCodeCommands.refresh);
					}).catch((e) => {
						vscode.window.showInformationMessage(`Failure executing Redeploy Collection command: RC ${e}`);
					});
					break;
				}
				case VSCodeCommands.redeployOperator: {
					vscode.window.showInformationMessage("Redeploy Operator request in progress");
					const poll = util.pollRun(40);
					const runRedeployOperatorCommand = ocSdkCommand.runRedeployOperatorCommand(outputChannel);
					Promise.all([poll, runRedeployOperatorCommand]).then(() => {
						vscode.window.showInformationMessage("Redeploy Operator command executed successfully");
						vscode.commands.executeCommand(VSCodeCommands.refresh);
					}).catch((e) => {
						vscode.window.showInformationMessage(`Failure executing Redeploy Operator command: RC ${e}`);
					});
					break;
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
function executeSdkCommandWithUserInput(command: string, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (operatorItemArg: OperatorItem) => {
		console.log("Creating executeSdkCommandWithUserInput");
		let workspacePath: string | undefined = "";
		if (operatorItemArg) {
			console.log("Found operatorItemArg");
			workspacePath = operatorItemArg.workspacePath;
		} else {
			let pwd = util.getCurrentWorkspaceRootFolder();
			if (pwd) {
				workspacePath = await util.selectOperatorInWorkspace(pwd);
				workspacePath = path.parse(workspacePath!).dir;
			}
		}
		if (workspacePath) {
			outputChannel?.show();
			if (command === VSCodeCommands.createOperator) {
				let playbookArgs = await util.requestOperatorInfo(workspacePath);
				if (playbookArgs) {
					let ocSdkCommand = new OcSdkCommand(workspacePath);
					if (playbookArgs.length === 1 && playbookArgs[0].includes("ocsdk-extra-vars")) {
						vscode.window.showInformationMessage("Create Operator request in progress using local variables file");
					} else {
						vscode.window.showInformationMessage("Create Operator request in progress");
					}
					console.log("Creating operator");
					const poll = util.pollRun(40);
					const runCreateOperatorCommand = ocSdkCommand.runCreateOperatorCommand(playbookArgs, outputChannel);
					Promise.all([poll, runCreateOperatorCommand]).then(() => {
						vscode.window.showInformationMessage("Create Operator command executed successfully");
						vscode.commands.executeCommand(VSCodeCommands.refresh);
					}).catch((e) => {
						vscode.window.showInformationMessage(`Failure executing Create Operator command: RC ${e}`);
					});
				}
			}
		};
	});
}

function deleteCustomResource(command: string, k8s: KubernetesObj) {
	return vscode.commands.registerCommand(command, async (customResourcArg: CustomResourcesItem) => {
		const name = customResourcArg.customResourceObj.metadata.name;
		const apiVersion = customResourcArg.customResourceObj.apiVersion.split("/")[1];
		const kind = customResourcArg.customResourceObj.kind;
		const poll = util.pollRun(15);
		const deleteCustomResourceCmd = k8s.deleteCustomResource(name, apiVersion, kind);
		Promise.all([poll, deleteCustomResourceCmd]).then((values) => {
			const deleteSuccessful = values[1];
			if (deleteSuccessful) {
				vscode.window.showInformationMessage(`Successfully deleted ${kind} resource`);
				vscode.commands.executeCommand(VSCodeCommands.resourceRefresh);
			} else {
				vscode.window.showErrorMessage(`Failed to delete ${kind} resource`);
			}
		}).catch((e) => {
			vscode.window.showErrorMessage(`Failed to delete ${kind} resource: ${e}`);
		});
	});
}
