/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as util from "./utilities/util";
import * as path from 'path';
import * as fs from 'fs';
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
import {OperatorConfig} from './linter/models'
import {AnsibleGalaxyYmlSchema} from './linter/galaxy'
import * as yaml from 'js-yaml';

export async function activate(context: vscode.ExtensionContext) {
  // Set context as a global as some tests depend on it
  (global as any).testExtensionContext = context;
  initResources(context);

	//Setup Linter
	const collection = vscode.languages.createDiagnosticCollection('linter');
	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document, collection);
	}
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDiagnostics(editor.document, collection);
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(textDocument => {
		if (textDocument) {
			updateDiagnostics(textDocument, collection);
		}
	}));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(textDocumentChangeEvent => {
			updateDiagnostics(textDocumentChangeEvent.document, collection);
	}));

	const ocSdkCmd = new OcSdkCommand();
	const ocCmd = new OcCommand();
	const session = new Session(ocSdkCmd);

  await session.validateOcSDKInstallation();
  await session.validateOpenShiftAccess();
  const outputChannel = vscode.window.createOutputChannel(
    "IBM Operator Collection SDK",
  );

  const operatorTreeProvider = new OperatorsTreeProvider(session);
  const resourceTreeProvider = new ResourcesTreeProvider(session);
  const openshiftTreeProvider = new OpenShiftTreeProvider(session);
  const linksTreeProvider = new LinksTreeProvider();
  const containerLogProvider = new ContainerLogProvider(session);
  const verboseContainerLogProvider = new VerboseContainerLogProvider(session);
  const customResourceDisplayProvider = new CustomResourceDisplayProvider(
    session,
  );

  // Register Providers
  vscode.window.registerTreeDataProvider(
    VSCodeViewIds.operators,
    operatorTreeProvider,
  );
  vscode.window.registerTreeDataProvider(
    VSCodeViewIds.resources,
    resourceTreeProvider,
  );
  vscode.window.registerTreeDataProvider(VSCodeViewIds.help, linksTreeProvider);
  vscode.window.registerTreeDataProvider(
    VSCodeViewIds.openshiftClusterInfo,
    openshiftTreeProvider,
  );
  vscode.workspace.registerTextDocumentContentProvider(
    util.logScheme,
    containerLogProvider,
  );
  vscode.workspace.registerTextDocumentContentProvider(
    util.verboseLogScheme,
    verboseContainerLogProvider,
  );
  vscode.workspace.registerTextDocumentContentProvider(
    util.customResourceScheme,
    customResourceDisplayProvider,
  );

  // Register Commands
  vscode.commands.executeCommand(
    "setContext",
    VSCodeCommands.sdkInstalled,
    await session.validateOcSDKInstallation(),
  );
  vscode.commands.executeCommand(
    "setContext",
    VSCodeCommands.loggedIn,
    await session.validateOpenShiftAccess(),
  );
  vscode.commands.executeCommand(
    "setContext",
    VSCodeCommands.sdkOutdatedVersion,
    await session.determinateOcSdkIsOutdated(),
  );
  context.subscriptions.push(logIn(VSCodeCommands.login, ocCmd, session));
  context.subscriptions.push(
    installOcSdk(VSCodeCommands.install, ocSdkCmd, session, outputChannel),
  );
  context.subscriptions.push(
    updateOcSdkVersion(
      VSCodeCommands.sdkUpgradeVersion,
      ocSdkCmd,
      session,
      outputChannel,
    ),
  );
  context.subscriptions.push(
    updateProject(VSCodeCommands.updateProject, ocCmd),
  );
  context.subscriptions.push(
    executeSdkCommandWithUserInput(
      VSCodeCommands.createOperator,
      outputChannel,
    ),
  );
  context.subscriptions.push(
    executeSimpleSdkCommand(VSCodeCommands.deleteOperator, outputChannel),
  );
  context.subscriptions.push(
    executeSimpleSdkCommand(VSCodeCommands.redeployCollection, outputChannel),
  );
  context.subscriptions.push(
    executeSimpleSdkCommand(VSCodeCommands.redeployOperator, outputChannel),
  );
  context.subscriptions.push(
    deleteCustomResource(VSCodeCommands.deleteCustomResource),
  );
  context.subscriptions.push(
    executeContainerViewLogCommand(VSCodeCommands.viewLogs),
  );
  context.subscriptions.push(
    executeContainerViewLogCommand(VSCodeCommands.viewVerboseLogs),
  );
  context.subscriptions.push(
    executeOpenLinkCommand(VSCodeCommands.openEditLink),
  );
  context.subscriptions.push(
    executeOpenLinkCommand(VSCodeCommands.openAddLink),
  );
  context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openLink));
  context.subscriptions.push(viewResourceCommand(VSCodeCommands.viewResource));
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refresh, () => {
      operatorTreeProvider.refresh();
      resourceTreeProvider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.resourceRefresh, () => {
      resourceTreeProvider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refreshAll, () => {
      openshiftTreeProvider.refresh();
      operatorTreeProvider.refresh();
      resourceTreeProvider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refreshOpenShiftInfo, () => {
      openshiftTreeProvider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      VSCodeCommands.sdkUpgradeVersionSkip,
      () => {
        session.setSkipOcSdkVersionUpdateFlag().then(() => {
          session.determinateOcSdkIsOutdated().then((isOutdated) => {
            vscode.commands.executeCommand(
              "setContext",
              VSCodeCommands.sdkOutdatedVersion,
              isOutdated,
            );
            vscode.commands.executeCommand(VSCodeCommands.refresh);
          });
        });
      },
    ),
  );
}

function installOcSdk(
  command: string,
  ocSdkCmd: OcSdkCommand,
  session: Session,
  outputChannel?: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (logPath?: string) => {
    try {
      await ocSdkCmd.runCollectionVerifyCommand(undefined, logPath);
      session.ocSdkInstalled = true;
    } catch (e) {
      session.ocSdkInstalled = false;
    }
    if (session.ocSdkInstalled) {
      vscode.window.showInformationMessage(
        "IBM Operator Collection SDK already installed",
      );
      vscode.commands.executeCommand(VSCodeCommands.refresh);
    } else {
      outputChannel?.show();
      vscode.window.showInformationMessage(
        "Installing the IBM Operator Collection SDK",
      );
      ocSdkCmd
        .installOcSDKCommand(outputChannel, logPath)
        .then(() => {
          session.ocSdkInstalled = true;
          vscode.window.showInformationMessage(
            "Successfully installed the IBM Operator Collection SDK",
          );
          vscode.commands.executeCommand(
            "setContext",
            VSCodeCommands.sdkInstalled,
            session.ocSdkInstalled,
          );
          vscode.commands.executeCommand(VSCodeCommands.login);
          vscode.commands.executeCommand(VSCodeCommands.refresh);
        })
        .catch((e) => {
          vscode.window.showErrorMessage(
            `Failure installing the IBM Operator Collection SDK: ${e}`,
          );
        });
    }
  });
}

function updateOcSdkVersion(
  command: string,
  ocSdkCmd: OcSdkCommand,
  session: Session,
  outputChannel?: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (logPath?: string) => {
    try {
      vscode.window.showInformationMessage(
        "Upgrading the IBM Operator Collection SDK to the latest version available in galaxy server",
      );
      ocSdkCmd.upgradeOCSDKtoLatestVersion().then(() => {
        vscode.window.showInformationMessage(
          "Successfully upgraded to the latest IBM Operator Collection SDK available in galaxy server",
        );
        vscode.commands.executeCommand(
          "setContext",
          VSCodeCommands.sdkOutdatedVersion,
          false,
        );
        vscode.commands.executeCommand(VSCodeCommands.refresh);
      });
    } catch (e) {
      vscode.window.showErrorMessage(
        `Failure upgrading the IBM Operator Collection SDK: ${e}`,
      );
      vscode.commands.executeCommand(
        "setContext",
        VSCodeCommands.sdkOutdatedVersion,
        true,
      );
      vscode.commands.executeCommand(VSCodeCommands.refresh);
    }
  });
}

function updateProject(
  command: string,
  ocCmd: OcCommand,
  outputChannel?: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    command,
    async (arg: OpenShiftItem, logPath?: string) => {
      const k8s = new KubernetesObj();
      let namespace: string | undefined;
      if (arg.description === k8s.namespace) {
        // implies that the edit button was selected in the editor
        namespace = await util.generateProjectDropDown();
      } else {
        // allows for tests to pass in new namespace directly
        namespace = arg.description;
      }

      if (namespace) {
        ocCmd
          .runOcProjectCommand(namespace, outputChannel, logPath)
          .then(() => {
            vscode.window.showInformationMessage(
              "Successfully updating Project on OpenShift cluster",
            );
            vscode.commands.executeCommand(VSCodeCommands.refreshAll);
          })
          .catch((e) => {
            vscode.window.showErrorMessage(
              `Failure updating Project on OpenShift cluster: ${e}`,
            );
          });
      }
    },
  );
}

function logIn(
  command: string,
  ocCmd: OcCommand,
  session: Session,
  outputChannel?: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    command,
    async (params?: string[], logPath?: string) => {
      let args: string[] | undefined = [];
      if (params === undefined || params?.length === 0) {
        args = await util.requestLogInInfo();
      } else {
        args = params;
      }
      if (args) {
        ocCmd
          .runOcLoginCommand(args, outputChannel, logPath)
          .then(() => {
            session.loggedIntoOpenShift = true;
            vscode.window.showInformationMessage(
              "Successfully logged into OpenShift cluster",
            );
            vscode.commands.executeCommand(VSCodeCommands.refreshAll);
          })
          .catch(() => {
            session.loggedIntoOpenShift = false;
            vscode.window.showErrorMessage(
              `Failure logging into OpenShift cluster`,
            );
          });
      }
    },
  );
}

type CustomResources =
  | ZosEndpointsItem
  | SubOperatorConfigsItem
  | OperatorCollectionsItem
  | CustomResourceItem
  | CustomResourcesItem;
function executeOpenLinkCommand(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(
    command,
    async (args: CustomResources | LinkItem) => {
      let linkUri = vscode.Uri.parse(args.link);
      let res = await vscode.env.openExternal(linkUri);
      if (!res) {
        vscode.window.showErrorMessage("Failure opening external link");
      }
    },
  );
}

function viewResourceCommand(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(
    command,
    async (args: CustomResources) => {
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
        vscode.window.showErrorMessage(
          "Unable to preview resource for invalid resource type",
        );
        return;
      }
      const uri = util.buildCustomResourceUri(
        kind!,
        instanceName!,
        group!,
        apiVersion!,
      );
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    },
  );
}

function executeContainerViewLogCommand(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(
    command,
    async (containerItemArgs: OperatorContainerItem, logPath?: string) => {
      const k8s = new KubernetesObj();
      const pwd = util.getCurrentWorkspaceRootFolder();
      if (!pwd) {
        vscode.window.showErrorMessage(
          "Unable to execute command when workspace is empty",
        );
      } else {
        let workspacePath = await util.selectOperatorInWorkspace(
          pwd,
          containerItemArgs.parentOperator.operatorName,
        );
        if (!workspacePath) {
          vscode.window.showErrorMessage(
            "Unable to locace valid operator collection in workspace",
          );
        } else {
          workspacePath = path.parse(workspacePath).dir;
          switch (command) {
            case VSCodeCommands.viewLogs: {
              const logUri = util.buildContainerLogUri(
                containerItemArgs.podObj.metadata?.name!,
                containerItemArgs.containerStatus.name,
              );
              const doc = await vscode.workspace.openTextDocument(logUri);
              await vscode.window.showTextDocument(doc, { preview: false });
              break;
            }
            case VSCodeCommands.viewVerboseLogs: {
              const apiVersion =
                await util.getConvertedApiVersion(workspacePath);
              const kind =
                await util.selectCustomResourceFromOperatorInWorkspace(
                  workspacePath,
                );
              let crInstance: string | undefined = "";
              if (apiVersion) {
                crInstance = await util.selectCustomResourceInstance(
                  workspacePath,
                  k8s,
                  apiVersion,
                  kind!,
                );
                if (kind && crInstance) {
                  const logUri = util.buildVerboseContainerLogUri(
                    containerItemArgs.podObj.metadata?.name!,
                    containerItemArgs.containerStatus.name,
                    apiVersion,
                    kind,
                    crInstance,
                  );
                  const doc = await vscode.workspace.openTextDocument(logUri);
                  await vscode.window.showTextDocument(doc, { preview: false });
                }
              } else {
                vscode.window.showErrorMessage(
                  "Unable to download log due to undefined version in operator-config",
                );
              }
            }
          }
        }
      }
    },
  );
}

/**
 * Executes a simple command without user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSimpleSdkCommand(
  command: string,
  outputChannel?: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    command,
    async (operatorItemArg: OperatorItem, logPath?: string) => {
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
          switch (command) {
            case VSCodeCommands.deleteOperator: {
              vscode.window.showInformationMessage(
                "Delete Operator request in progress",
              );
              const poll = util.pollRun(10);
              const runDeleteOperatorCommand =
                ocSdkCommand.runDeleteOperatorCommand(outputChannel, logPath);
              Promise.all([poll, runDeleteOperatorCommand])
                .then(() => {
                  vscode.window.showInformationMessage(
                    "Delete Operator command executed successfully",
                  );
                  vscode.commands.executeCommand(VSCodeCommands.refresh);
                })
                .catch((e) => {
                  vscode.window.showInformationMessage(
                    `Failure executing Delete Operator command: RC ${e}`,
                  );
                });
              break;
            }
            case VSCodeCommands.redeployCollection: {
              vscode.window.showInformationMessage(
                "Redeploy Collection request in progress",
              );
              const poll = util.pollRun(30);
              const runRedeployCollectionCommand =
                ocSdkCommand.runRedeployCollectionCommand(
                  outputChannel,
                  logPath,
                );
              Promise.all([poll, runRedeployCollectionCommand])
                .then(() => {
                  vscode.window.showInformationMessage(
                    "Redeploy Collection command executed successfully",
                  );
                  vscode.commands.executeCommand(VSCodeCommands.refresh);
                })
                .catch((e) => {
                  vscode.window.showInformationMessage(
                    `Failure executing Redeploy Collection command: RC ${e}`,
                  );
                });
              break;
            }
            case VSCodeCommands.redeployOperator: {
              vscode.window.showInformationMessage(
                "Redeploy Operator request in progress",
              );
              const poll = util.pollRun(40);
              const runRedeployOperatorCommand =
                ocSdkCommand.runRedeployOperatorCommand(outputChannel, logPath);
              Promise.all([poll, runRedeployOperatorCommand])
                .then(() => {
                  vscode.window.showInformationMessage(
                    "Redeploy Operator command executed successfully",
                  );
                  vscode.commands.executeCommand(VSCodeCommands.refresh);
                })
                .catch((e) => {
                  vscode.window.showInformationMessage(
                    `Failure executing Redeploy Operator command: RC ${e}`,
                  );
                });
              break;
            }
          }
        }
      }
    },
  );
}

/**
 * Executes a command that requires user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSdkCommandWithUserInput(
  command: string,
  outputChannel?: vscode.OutputChannel,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    command,
    async (operatorItemArg: OperatorItem, logPath?: string) => {
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
              if (
                playbookArgs.length === 1 &&
                playbookArgs[0].includes("ocsdk-extra-vars")
              ) {
                vscode.window.showInformationMessage(
                  "Create Operator request in progress using local variables file",
                );
              } else {
                vscode.window.showInformationMessage(
                  "Create Operator request in progress",
                );
              }
              const poll = util.pollRun(40);
              const runCreateOperatorCommand =
                ocSdkCommand.runCreateOperatorCommand(
                  playbookArgs,
                  outputChannel,
                  logPath,
                );
              Promise.all([poll, runCreateOperatorCommand])
                .then(() => {
                  vscode.window.showInformationMessage(
                    "Create Operator command executed successfully",
                  );
                  vscode.commands.executeCommand(VSCodeCommands.refresh);
                })
                .catch((e) => {
                  vscode.window.showInformationMessage(
                    `Failure executing Create Operator command: RC ${e}`,
                  );
                });
            }
          }
        }
      }
    },
  );
}

function deleteCustomResource(command: string) {
  return vscode.commands.registerCommand(
    command,
    async (customResourcArg: CustomResourcesItem) => {
      const k8s = new KubernetesObj();
      const validNamespace = await k8s.validateNamespaceExists();

      // validation may not be necessary in this case
      if (validNamespace) {
        const name = customResourcArg.customResourceObj.metadata.name;
        const apiVersion =
          customResourcArg.customResourceObj.apiVersion.split("/")[1];
        const kind = customResourcArg.customResourceObj.kind;
        const poll = util.pollRun(15);
        const deleteCustomResourceCmd = k8s.deleteCustomResource(
          name,
          apiVersion,
          kind,
        );
        Promise.all([poll, deleteCustomResourceCmd])
          .then((values) => {
            const deleteSuccessful = values[1];
            if (deleteSuccessful) {
              vscode.window.showInformationMessage(
                `Successfully deleted ${kind} resource`,
              );
              vscode.commands.executeCommand(VSCodeCommands.resourceRefresh);
            } else {
              vscode.window.showErrorMessage(
                `Failed to delete ${kind} resource`,
              );
            }
          })
          .catch((e) => {
            vscode.window.showErrorMessage(
              `Failed to delete ${kind} resource: ${e}`,
            );
          });
      }
    },
  );
}

async function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): Promise<void> {
	if (document && ( path.basename(document.uri.fsPath) === 'operator-config.yaml' ) || ( path.basename(document.uri.fsPath) === 'operator-config.yml' ) ){

		const configData = document.getText();
		const diagnostics : vscode.Diagnostic[] = [];
		const operatorConfig = yaml.load(configData) as OperatorConfig;

		//Try to read the galaxy.yml or galaxy.yaml document
		let galaxyData;
		let galaxyConfig;
		try {
			galaxyData = fs.readFileSync(path.join(path.dirname(document.uri.fsPath), 'galaxy.yaml'), 'utf8');
			galaxyConfig = yaml.load(galaxyData) as AnsibleGalaxyYmlSchema;
		} catch (err) {}
		if(!galaxyData){
			try {
				galaxyData = fs.readFileSync(path.join(path.dirname(document.uri.fsPath), 'galaxy.yml'), 'utf8');
				galaxyConfig = yaml.load(galaxyData) as AnsibleGalaxyYmlSchema;
			} catch (err) {
				diagnostics.push({
					range: new vscode.Range(document.positionAt(0),document.positionAt(0)),
					message: 'Missing galaxy.yaml file.',
					severity: vscode.DiagnosticSeverity.Error,
				});
			}
		}

		//Get document "symbols"
		//These are provided by the yaml extension
		//There is no way to check if the yaml extension has been loaded
		//So the only way to wait for it to load is to keep calling this
		//command until it succeeds.
		let docSymbols = undefined;
		while(!docSymbols){
			docSymbols = await vscode.commands.executeCommand(
				'vscode.executeDocumentSymbolProvider',
				document.uri
			) as vscode.DocumentSymbol[];
			//[Optional] Sleep to be mindful and not overload the command queue
			if(!docSymbols){
				await util.sleep(100);
			}
		}

		//If we succesfuly read the galaxy data we proceed to lint those features
		if(galaxyConfig !== undefined){

			//Validate that operatorConfig values name, version, and domain match galaxy name, version, and namespace
			if((galaxyConfig.namespace && operatorConfig.domain) && galaxyConfig.namespace.toLowerCase() !== operatorConfig.domain.toLowerCase()){
				//Get domain symbol
				const domainSymbol : vscode.DocumentSymbol | undefined = docSymbols.find( (symbol: vscode.DocumentSymbol) => (symbol.name === 'domain' && symbol.detail === operatorConfig.domain));
				if(domainSymbol){
					diagnostics.push({
						range: domainSymbol.range,
						message: 'Domain should match the namespace value specified in your galaxy.yml file, unless a fork/clone of an official Ansible Collection is desired.',
						severity: vscode.DiagnosticSeverity.Warning,
					});
				}
			}
			if((galaxyConfig.name && operatorConfig.name) && galaxyConfig.name.toLowerCase().replace('_','-') !== operatorConfig.name.toLowerCase().replace('_','-')){
				//Get name symbol
				const nameSymbol : vscode.DocumentSymbol | undefined = docSymbols.find( (symbol: vscode.DocumentSymbol) => (symbol.name === 'name' && symbol.detail === operatorConfig.name));
				if(nameSymbol){
					diagnostics.push({
						range: nameSymbol.range,
						message: 'Name should match the name specified in your galaxy.yml file, unless a fork/clone of an official Ansible Collection is desired.',
						severity: vscode.DiagnosticSeverity.Warning,
					});
				}
			}
			if((galaxyConfig.version && operatorConfig.version) && galaxyConfig.version !== operatorConfig.version){
				//Get version symbol
				const versionSymbol : vscode.DocumentSymbol | undefined = docSymbols.find( (symbol: vscode.DocumentSymbol) => (symbol.name === 'version' && symbol.detail === operatorConfig.version));
				if(versionSymbol){
					diagnostics.push({
						range: versionSymbol.range,
						message: 'Version should match the version specified in your galaxy.yml file.',
						severity: vscode.DiagnosticSeverity.Error,
					});
				}
			}

		}

		//Validate that an ansible config file does not exist or that it's listed in the build_ignore section of the galaxy.yml file
		try {
			fs.readFileSync(path.join(path.dirname(document.uri.fsPath), 'ansible.cfg'), 'utf8');
			if( !(galaxyConfig !== undefined && galaxyConfig.build_ignore?.find(ignore=>ignore==='ansible.cfg')) ){
				diagnostics.push({
					range: new vscode.Range(document.positionAt(0),document.positionAt(0)),
					message: "Collection build MUST not contain an ansible.cfg file. Please delete it or add this file to the build_ignore section of the galaxy.yml file.",
					severity: vscode.DiagnosticSeverity.Error,
				});
			}
		} catch (err) {}

		//Validate that playbook and finalizer paths exist
		if(operatorConfig.resources){
			//Get resources symbol
			const resourcesSymbol : vscode.DocumentSymbol | undefined = docSymbols.find( (symbol: vscode.DocumentSymbol) => (symbol.name === 'resources'));
			
			for (const resource of operatorConfig.resources) {
				//Get resource symbol
				const resourceSymbol = resourcesSymbol?.children.find( (symbol: vscode.DocumentSymbol) => {
					return symbol.children.find((child_symbol: vscode.DocumentSymbol)=>(child_symbol.name === 'kind' && child_symbol.detail === resource.kind))
				})
				//Validate Playbook
				if(resource.playbook){
					//Get playbook symbol
					const resourcePlaybookSymbol = resourceSymbol?.children.find((symbol: vscode.DocumentSymbol)=>(symbol.name === 'playbook' && symbol.detail === resource.playbook))
					//Check if path is absolute
					if(path.isAbsolute(resource.playbook)){
						if(resourcePlaybookSymbol){
							diagnostics.push({
								range: resourcePlaybookSymbol.range,
								message: `Playbook path MUST be relative to the root of the Operator Collection - ${resource.playbook}`,
								severity: vscode.DiagnosticSeverity.Error,
							});
						}
					}else{
						//Check if playbook exist
						try {
							fs.readFileSync(path.join(path.dirname(document.uri.fsPath), resource.playbook), 'utf8');
							const playbookDoc = await vscode.workspace.openTextDocument(path.join(path.dirname(document.uri.fsPath), resource.playbook));
							//Get playbook "symbols"
							const playbookDocSymbols = await vscode.commands.executeCommand(
								'vscode.executeDocumentSymbolProvider',
								playbookDoc.uri
							) as vscode.DocumentSymbol[];
							let plays : vscode.DocumentSymbol[] = [];
							playbookDocSymbols.forEach(symbol=>{
								const play = symbol.children.find(child_symbol=>child_symbol.name==='hosts');
								if(play){
									plays.push(play);
								}
							});
							if(plays.some(play=>play.detail !== 'all')){
								if(resourcePlaybookSymbol){
									diagnostics.push({
										range: resourcePlaybookSymbol.range,
										message: `Playbook MUST use a "hosts: all" value. - ${resource.playbook}`,
										severity: vscode.DiagnosticSeverity.Error,
									});
								}
							}

						} catch (err) {
							if(resourcePlaybookSymbol){
								diagnostics.push({
									range: resourcePlaybookSymbol.range,
									message: `Invalid Playbook for Kind ${resource.kind} - ${resource.playbook}`,
									severity: vscode.DiagnosticSeverity.Error,
								});
							}
						}
					}
				}
				//Validate Finalizer
				if(resource.finalizer){
					//Get finalizer symbol
					const resourceFinalizerymbol = resourceSymbol?.children.find((symbol: vscode.DocumentSymbol)=>(symbol.name === 'finalizer' && symbol.detail === resource.finalizer))
					//Check if path is absolute
					if(path.isAbsolute(resource.finalizer)){
						if(resourceFinalizerymbol){
							diagnostics.push({
								range: resourceFinalizerymbol.range,
								message: `Finalizer playbook path MUST be relative to the root of the Operator Collection - ${resource.finalizer}`,
								severity: vscode.DiagnosticSeverity.Error,
							});
						}
					}else{
						try {
							fs.readFileSync(path.join(path.dirname(document.uri.fsPath), resource.finalizer), 'utf8');
						} catch (err) {
							if(resourceFinalizerymbol){
								diagnostics.push({
									range: resourceFinalizerymbol.range,
									message: `Invalid Finalizer for Kind ${resource.kind} - ${resource.playbook}`,
									severity: vscode.DiagnosticSeverity.Error,
								});
							}
						}
					}
				}
			}
		}

		collection.set(document.uri, diagnostics);
	} else {
		collection.clear();
	}
}
