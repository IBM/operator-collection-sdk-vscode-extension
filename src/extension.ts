import * as vscode from 'vscode';
import * as util from "./utilities/util";
import * as path from 'path';
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
import {OcCommand} from "./commands/ocCommand";
import {OcSdkCommand} from './commands/ocSdkCommands';
import {Session} from "./utilities/session";

export async function activate(context: vscode.ExtensionContext) {
	initResources(context);
	const k8s = new KubernetesObj();
	const ocSdkCmd = new OcSdkCommand();
	const ocCmd = new OcCommand();
	const session = new Session();

	const isOcSDKinstalled = await session.validateOcSDKInstallation();
	const userLoggedIntoOCP = await session.validateOpenShiftAccess();



	const operatorTreeProvider = new OperatorsTreeProvider(session);
	const resourceTreeProvider = new ResourcesTreeProvider(session);
	const openshiftTreeProvider = new OpenShiftTreeProvider(session);
	const linksTreeProvider = new LinksTreeProvider();

	
	vscode.commands.executeCommand("setContext", "operator-collection-sdk.sdkInstalled", isOcSDKinstalled);
	vscode.commands.executeCommand("setContext", "operator-collection-sdk.loggedIn", userLoggedIntoOCP);
	vscode.window.registerTreeDataProvider('operator-collection-sdk.operators', operatorTreeProvider);
	vscode.window.registerTreeDataProvider('operator-collection-sdk.resources', resourceTreeProvider);
	vscode.window.registerTreeDataProvider('operator-collection-sdk.links', linksTreeProvider);
	vscode.window.registerTreeDataProvider('operator-collection-sdk.openshiftClusterInfo', openshiftTreeProvider);
	context.subscriptions.push(signIn("operator-collection-sdk.login", ocCmd, session));
	context.subscriptions.push(installOcSdk("operator-collection-sdk.install", ocSdkCmd, session));
	context.subscriptions.push(updateProject("operator-collection-sdk.updateProject", ocCmd));
	context.subscriptions.push(executeSdkCommandWithUserInput("operator-collection-sdk.createOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.deleteOperator"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployCollection"));
	context.subscriptions.push(executeSimpleSdkCommand("operator-collection-sdk.redeployOperator"));
	context.subscriptions.push(deleteCustomResource("operator-collection-sdk.deleteCustomResource", k8s));
	context.subscriptions.push(executeContainerLogDownloadCommand("operator-collection-sdk.downloadLogs", k8s));
	context.subscriptions.push(executeContainerLogDownloadCommand("operator-collection-sdk.downloadVerboseLogs", k8s));
	context.subscriptions.push(executeOpenLinkCommand("operator-collection-sdk.openEditLink"));
	context.subscriptions.push(executeOpenLinkCommand("operator-collection-sdk.openAddLink"));
	context.subscriptions.push(executeOpenLinkCommand("operator-collection-sdk.openLink"));
	context.subscriptions.push(vscode.commands.registerCommand("operator-collection-sdk.refresh", () => {
		operatorTreeProvider.refresh();
		resourceTreeProvider.refresh();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("operator-collection-sdk.resourceRefresh", () => {
		resourceTreeProvider.refresh();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("operator-collection-sdk.refreshAll", () => {
		openshiftTreeProvider.refresh();
		operatorTreeProvider.refresh();
		resourceTreeProvider.refresh();
	}));
}

function installOcSdk(command: string, ocSdkCmd: OcSdkCommand, session: Session): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		try {
			await ocSdkCmd.runCollectionVerifyCommand(true);
			session.ocSdkInstalled = true;
		} catch(e) {
			vscode.window.showWarningMessage("Install the IBM Operator Collection SDK use this extension");
			session.ocSdkInstalled = false;
		}
		if (session.ocSdkInstalled) {
			vscode.window.showInformationMessage("IBM Operator Collection SDK already installed");
			vscode.commands.executeCommand("operator-collection-sdk.refresh");
		} else {
			vscode.window.showInformationMessage("Installing the IBM Operator Collection SDK");
			ocSdkCmd.installOcSDKCommand().then(()=> {
				session.ocSdkInstalled = true;
				vscode.window.showInformationMessage("Successfully installed the IBM Operator Collection SDK");
				vscode.commands.executeCommand("operator-collection-sdk.refresh");
			}).catch((e) => {
				vscode.window.showErrorMessage(`Failure installing the IBM Operator Collection SDK: ${e}`);
			});
		}
	});
}

function updateProject(command: string, ocCmd: OcCommand): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		const namespace = await util.generateProjectDropDown();
		if (namespace) {
			ocCmd.runOcProjectCommand(namespace).then(() => {
				vscode.window.showInformationMessage("Successfully updating Project on OpenShift cluster");
				vscode.commands.executeCommand("operator-collection-sdk.refreshAll");
			}).catch((e) => {
				vscode.window.showErrorMessage(`Failure updating Project on OpenShift cluster: ${e}`);
			});
		}
	});
}

function signIn(command: string, ocCmd: OcCommand, session: Session): vscode.Disposable {
	return vscode.commands.registerCommand(command, async () => {
		const args = await util.requestLogInInfo();
		if (args) {
			ocCmd.runOcLoginCommand(args).then(() => {
				session.loggedIntoOpenShift = true;
				vscode.window.showInformationMessage("Successfully logged into OpenShift cluster");
				vscode.commands.executeCommand("operator-collection-sdk.refreshAll");
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
	});
}

/**
 * Executes a command that requires user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSdkCommandWithUserInput(command: string): vscode.Disposable {
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
			if (command === "operator-collection-sdk.createOperator") {
				let playbookArgs = await util.requestOperatorInfo(workspacePath);
				if (playbookArgs) {
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
	});
}

function deleteCustomResource(command: string, k8s: KubernetesObj) {
	return vscode.commands.registerCommand(command, async (customResourcArg: CustomResourcesItem) => {
		const name = customResourcArg.customResourceObj.metadata.name
		const apiVersion = customResourcArg.customResourceObj.apiVersion.split("/")[1];
		const kind = customResourcArg.customResourceObj.kind;
		const deleteSuccessful = await k8s.deleteCustomResource(name, apiVersion, kind);
		if (deleteSuccessful) {
			vscode.window.showInformationMessage(`Successfully deleted ${kind} resource`);
			vscode.commands.executeCommand("operator-collection-sdk.resourceRefresh");
		} else {
			vscode.window.showErrorMessage(`Failed to delete ${kind} resource`);
		}
	});
}
