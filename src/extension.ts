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
import {OpenShiftItem} from './treeViews/openshiftItems/openshiftItem';
import {ResourcesTreeProvider} from './treeViews/providers/resourceProvider';
import {OpenShiftTreeProvider} from './treeViews/providers/openshiftProvider';
import {LinksTreeProvider} from './treeViews/providers/linkProvider';
import {ContainerLogProvider} from './treeViews/providers/containerLogProvider';
import {VerboseContainerLogProvider} from './treeViews/providers/verboseContainerLogProvider';
import {CustomResourceDisplayProvider} from './treeViews/providers/customResourceDisplayProviders';
import {OperatorContainerItem} from "./treeViews/operatorItems/operatorContainerItem";
import {ZosEndpointsItem} from "./treeViews/resourceItems/zosendpointsItem";
import {OperatorCollectionsItem} from "./treeViews/resourceItems/operatorCollectionsItem";
import {SubOperatorConfigsItem} from "./treeViews/resourceItems/subOperatorConfigsItem";
import {CustomResourceItem} from "./treeViews/resourceItems/customResourceItem";
import {CustomResourcesItem} from "./treeViews/resourceItems/customResourcesItem";
import {LinkItem} from "./treeViews/linkItems/linkItem";
import {initResources} from './treeViews/icons';
import {KubernetesObj} from "./kubernetes/kubernetes";
import {OcCommand} from "./shellCommands/ocCommand";
import {OcSdkCommand} from './shellCommands/ocSdkCommands';
import {Session} from "./utilities/session";

export async function activate(context: vscode.ExtensionContext) {
	// Set context as a global as some tests depend on it
	(global as any).testExtensionContext = context;
	initResources(context);

	const ocSdkCmd = new OcSdkCommand();
	const ocCmd = new OcCommand();
	const session = new Session(ocSdkCmd);

	await session.validateOcSDKInstallation();
	await session.validateOpenShiftAccess();
	const outputChannel = vscode.window.createOutputChannel('IBM Operator Collection SDK');



	const operatorTreeProvider = new OperatorsTreeProvider(session);
	const resourceTreeProvider = new ResourcesTreeProvider(session);
	const openshiftTreeProvider = new OpenShiftTreeProvider(session);
	const linksTreeProvider = new LinksTreeProvider();
	const containerLogProvider = new ContainerLogProvider(session);
	const verboseContainerLogProvider = new VerboseContainerLogProvider(session);
	const customResourceDisplayProvider = new CustomResourceDisplayProvider(session);

	// Register Providers
	vscode.window.registerTreeDataProvider(VSCodeViewIds.operators, operatorTreeProvider);
	vscode.window.registerTreeDataProvider(VSCodeViewIds.resources, resourceTreeProvider);
	vscode.window.registerTreeDataProvider(VSCodeViewIds.help, linksTreeProvider);
	vscode.window.registerTreeDataProvider(VSCodeViewIds.openshiftClusterInfo, openshiftTreeProvider);
	vscode.workspace.registerTextDocumentContentProvider(util.logScheme, containerLogProvider);
	vscode.workspace.registerTextDocumentContentProvider(util.verboseLogScheme, verboseContainerLogProvider);
	vscode.workspace.registerTextDocumentContentProvider(util.customResourceScheme, customResourceDisplayProvider);

	
	// Register Commands
	vscode.commands.executeCommand("setContext", VSCodeCommands.sdkInstalled, await session.validateOcSDKInstallation());
	vscode.commands.executeCommand("setContext", VSCodeCommands.loggedIn, await session.validateOpenShiftAccess());
	vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion, await session.determinateOcSdkIsOutdated());
	context.subscriptions.push(logIn(VSCodeCommands.login, ocCmd, session));
	context.subscriptions.push(installOcSdk(VSCodeCommands.install, ocSdkCmd, session, outputChannel));
	context.subscriptions.push(updateOcSdkVersion(VSCodeCommands.sdkUpgradeVersion, ocSdkCmd, session, outputChannel));
	context.subscriptions.push(updateProject(VSCodeCommands.updateProject, ocCmd));
	context.subscriptions.push(executeSdkCommandWithUserInput(VSCodeCommands.createOperator, outputChannel));
	context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.deleteOperator, outputChannel));
	context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.redeployCollection, outputChannel));
	context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.redeployOperator, outputChannel));
	context.subscriptions.push(deleteCustomResource(VSCodeCommands.deleteCustomResource));
	context.subscriptions.push(executeContainerViewLogCommand(VSCodeCommands.viewLogs));
	context.subscriptions.push(executeContainerViewLogCommand(VSCodeCommands.viewVerboseLogs));
	context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openEditLink));
	context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openAddLink));
	context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openLink));
	context.subscriptions.push(viewResourceCommand(VSCodeCommands.viewResource));
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
	context.subscriptions.push(vscode.commands.registerCommand(VSCodeCommands.refreshOpenShiftInfo, () => {
		openshiftTreeProvider.refresh();
	}));
	context.subscriptions.push(vscode.commands.registerCommand(VSCodeCommands.sdkUpgradeVersionSkip, () => {
		session.setSkipOcSdkVersionUpdateFlag().then( () => {
			session.determinateOcSdkIsOutdated().then((isOutdated) => {
				vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion,isOutdated);
				vscode.commands.executeCommand(VSCodeCommands.refresh);
			})
		})

	}));
}

function installOcSdk(command: string, ocSdkCmd: OcSdkCommand, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (logPath?: string) => {
		try {
			await ocSdkCmd.runCollectionVerifyCommand(undefined, logPath);
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
			ocSdkCmd.installOcSDKCommand(outputChannel, logPath).then(()=> {
				session.ocSdkInstalled = true;
				vscode.window.showInformationMessage("Successfully installed the IBM Operator Collection SDK");
				vscode.commands.executeCommand("setContext", VSCodeCommands.sdkInstalled, session.ocSdkInstalled);
				vscode.commands.executeCommand(VSCodeCommands.login);
				vscode.commands.executeCommand(VSCodeCommands.refresh);
			}).catch((e) => {
				vscode.window.showErrorMessage(`Failure installing the IBM Operator Collection SDK: ${e}`);
			});
		}
	});
}

function updateOcSdkVersion (command: string, ocSdkCmd: OcSdkCommand, session: Session, outputChannel?: vscode.OutputChannel) : vscode.Disposable {
	return vscode.commands.registerCommand(command, async (logPath?: string) => {
		try {
			vscode.window.showInformationMessage("Upgrading the IBM Operator Collection SDK to the latest version available in galaxy server");
			ocSdkCmd.upgradeOCSDKtoLatestVersion().then(()=>{
				vscode.window.showInformationMessage("Successfully upgraded to the latest IBM Operator Collection SDK available in galaxy server");
				vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion,false);
				vscode.commands.executeCommand(VSCodeCommands.refresh);
			})
		
		} catch(e) {
			vscode.window.showErrorMessage(`Failure upgrading the IBM Operator Collection SDK: ${e}`);
			vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion,true);
			vscode.commands.executeCommand(VSCodeCommands.refresh);
		}

	});
}


function updateProject(command: string, ocCmd: OcCommand, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (arg: OpenShiftItem, logPath?: string) => {
		const k8s = new KubernetesObj();
		let namespace: string | undefined;
		if (arg.description === k8s.namespace) { // implies that the edit button was selected in the editor
			namespace = await util.generateProjectDropDown();
		} else { // allows for tests to pass in new namespace directly
			namespace = arg.description;
		}

		if (namespace) {
			ocCmd.runOcProjectCommand(namespace, outputChannel, logPath).then(() => {
				vscode.window.showInformationMessage("Successfully updating Project on OpenShift cluster");
				vscode.commands.executeCommand(VSCodeCommands.refreshAll);
			}).catch((e) => {
				vscode.window.showErrorMessage(`Failure updating Project on OpenShift cluster: ${e}`);
			});
		}
	});
}

function logIn(command: string, ocCmd: OcCommand, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (params?: string[], logPath?: string) => {
		let args: string[] | undefined = [];
		if (params === undefined || params?.length === 0) {
			args = await util.requestLogInInfo();
		} else {
			args = params;
		}
		if (args) {
			ocCmd.runOcLoginCommand(args, outputChannel, logPath).then(() => {
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

type CustomResources = ZosEndpointsItem | SubOperatorConfigsItem | OperatorCollectionsItem | CustomResourceItem | CustomResourcesItem;
function executeOpenLinkCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (args: CustomResources | LinkItem) => {
		let linkUri = vscode.Uri.parse(args.link);
		let res = await vscode.env.openExternal(linkUri);
		if (!res) {
			vscode.window.showErrorMessage("Failure opening external link");
		}
	});
}

function viewResourceCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (args: CustomResources) => {
		let kind: string;
		let instanceName: string;
		let group: string;
		let apiVersion: string;
		if (args instanceof ZosEndpointsItem) {
			kind = args.zosendpointObj.kind;
			instanceName = args.zosendpointObj.metadata.name;
			group = args.zosendpointObj.apiVersion.split("/")[0];
			apiVersion = args.zosendpointObj.apiVersion.split("/")[1];
		} else if (args instanceof SubOperatorConfigsItem) {
			kind = args.subOperatorConfigObj.kind;
			instanceName = args.subOperatorConfigObj.metadata.name;
			group = args.subOperatorConfigObj.apiVersion.split("/")[0];
			apiVersion = args.subOperatorConfigObj.apiVersion.split("/")[1];
		} else if (args instanceof OperatorCollectionsItem) {
			kind = args.operatorCollectionObj.kind;
			instanceName = args.operatorCollectionObj.metadata.name;
			group = args.operatorCollectionObj.apiVersion.split("/")[0];
			apiVersion = args.operatorCollectionObj.apiVersion.split("/")[1];
		} else if (args instanceof CustomResourcesItem) {
			kind = args.customResourceObj.kind;
			instanceName = args.customResourceObj.metadata.name;
			group = args.customResourceObj.apiVersion.split("/")[0];
			apiVersion = args.customResourceObj.apiVersion.split("/")[1];
		} else {
			vscode.window.showErrorMessage("Unable to preview resource for invalid resource type");
			return;
		}
		const uri = util.buildCustomResourceUri(kind!, instanceName!, group!, apiVersion!);
		const doc = await vscode.workspace.openTextDocument(uri);
		await vscode.window.showTextDocument(doc, {preview: false});
	});
}

function executeContainerViewLogCommand(command: string): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (containerItemArgs: OperatorContainerItem, logPath?: string) => {
		if (containerItemArgs) {
			const k8s = new KubernetesObj();
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
						case VSCodeCommands.viewLogs: {
							const logUri = util.buildContainerLogUri(containerItemArgs.podObj.metadata?.name!, containerItemArgs.containerStatus.name);
							const doc = await vscode.workspace.openTextDocument(logUri);
							await vscode.window.showTextDocument(doc, {preview: false});
							break;
						}
						case VSCodeCommands.viewVerboseLogs: {
							const apiVersion = await util.getConvertedApiVersion(workspacePath);
							const kind = await util.selectCustomResourceFromOperatorInWorkspace(workspacePath);
							let crInstance: string | undefined = "";
							if (apiVersion) {
								crInstance = await util.selectCustomResourceInstance(workspacePath, k8s, apiVersion, kind!);
								if (kind && crInstance) {
									const logUri = util.buildVerboseContainerLogUri(containerItemArgs.podObj.metadata?.name!, containerItemArgs.containerStatus.name, apiVersion, kind, crInstance);
									const doc = await vscode.workspace.openTextDocument(logUri);
									await vscode.window.showTextDocument(doc, {preview: false});
								} 
							} else {
								vscode.window.showErrorMessage("Unable to download log due to undefined version in operator-config");
							}
						}
					}
				}
			}	
		} else {
			vscode.window.showInformationMessage("Please wait for the operator to finish loading, then try again.");
		}
	});
}

/**
 * Executes a simple command without user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSimpleSdkCommand(command: string, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (operatorItemArg: OperatorItem, logPath?: string) => {
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
			const k8s = new KubernetesObj();
			const validNamespace = await k8s.validateNamespaceExists();
			if (validNamespace) {
				let ocSdkCommand = new OcSdkCommand(workspacePath);
				outputChannel?.show();
				switch(command) {
					case VSCodeCommands.deleteOperator: {
						vscode.window.showInformationMessage("Delete Operator request in progress");
						const poll = util.pollRun(10);
						const runDeleteOperatorCommand = ocSdkCommand.runDeleteOperatorCommand(outputChannel, logPath);
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
						const runRedeployCollectionCommand = ocSdkCommand.runRedeployCollectionCommand(outputChannel, logPath);
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
						const runRedeployOperatorCommand = ocSdkCommand.runRedeployOperatorCommand(outputChannel, logPath);
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
		}
	});
}

/**
 * Executes a command that requires user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSdkCommandWithUserInput(command: string, outputChannel?: vscode.OutputChannel): vscode.Disposable {
	return vscode.commands.registerCommand(command, async (operatorItemArg: OperatorItem, logPath?: string) => {
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
			const k8s = new KubernetesObj();
			const validNamespace = await k8s.validateNamespaceExists();
			if (validNamespace) {
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
						const poll = util.pollRun(40);
						const runCreateOperatorCommand = ocSdkCommand.runCreateOperatorCommand(playbookArgs, outputChannel, logPath);
						Promise.all([poll, runCreateOperatorCommand]).then(() => {
							vscode.window.showInformationMessage("Create Operator command executed successfully");
							vscode.commands.executeCommand(VSCodeCommands.refresh);
						}).catch((e) => {
							vscode.window.showInformationMessage(`Failure executing Create Operator command: RC ${e}`);
						});
					}
				}
			}
		};
	});
}

function deleteCustomResource(command: string) {
	return vscode.commands.registerCommand(command, async (customResourcArg: CustomResourcesItem) => {
		const k8s = new KubernetesObj();
		const validNamespace = await k8s.validateNamespaceExists();
		if (validNamespace) {
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
		}
	});
}
