/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as util from "./utilities/util";
import * as workspace from "./utilities/workspace";
import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import { VSCodeCommands, VSCodeViewIds, VSCodeDiagnosticMessages } from "./utilities/commandConstants";
import { ScaffoldCodeActionProvider } from "./treeViews/providers/scaffoldCodeActionProvider";
import { OperatorsTreeProvider } from "./treeViews/providers/operatorProvider";
import { OperatorItem } from "./treeViews/operatorItems/operatorItem";
import { OpenShiftItem } from "./treeViews/openshiftItems/openshiftItem";
import { ResourcesTreeProvider } from "./treeViews/providers/resourceProvider";
import { OpenShiftTreeProvider } from "./treeViews/providers/openshiftProvider";
import { LinksTreeProvider } from "./treeViews/providers/linkProvider";
import { ContainerLogProvider } from "./treeViews/providers/containerLogProvider";
import { VerboseContainerLogProvider } from "./treeViews/providers/verboseContainerLogProvider";
import { CustomResourceDisplayProvider } from "./treeViews/providers/customResourceDisplayProviders";
import { OperatorContainerItem } from "./treeViews/operatorItems/operatorContainerItem";
import { ZosEndpointsItem } from "./treeViews/resourceItems/zosendpointsItem";
import { OperatorCollectionsItem } from "./treeViews/resourceItems/operatorCollectionsItem";
import { SubOperatorConfigsItem } from "./treeViews/resourceItems/subOperatorConfigsItem";
import { CustomResourceItem } from "./treeViews/resourceItems/customResourceItem";
import { CustomResourcesItem } from "./treeViews/resourceItems/customResourcesItem";
import { LinkItem } from "./treeViews/linkItems/linkItem";
import { initResources } from "./treeViews/icons";
import { KubernetesObj } from "./kubernetes/kubernetes";
import { OcCommand } from "./shellCommands/ocCommand";
import { OcSdkCommand } from "./shellCommands/ocSdkCommands";
import { Session } from "./utilities/session";
import { OperatorConfig } from "./linter/models";
import { AnsibleGalaxyYmlSchema } from "./linter/galaxy";
import { getLinterSettings, LinterSettings } from "./utilities/util";
import { AboutTreeProvider } from "./treeViews/providers/aboutProvider";
import * as BoilerplateContent from "./utilities/Boilerplate/Boilerplate";

export async function activate(context: vscode.ExtensionContext) {
  // Set context as a global as some tests depend on it
  (global as any).testExtensionContext = context;
  initResources(context);

  //Setup Linter
  const linterEnabled = getLinterSettings(LinterSettings.lintingEnabled) as string;
  if (linterEnabled) {
    const collection = vscode.languages.createDiagnosticCollection("linter");
    if (vscode.window.activeTextEditor) {
      updateDiagnostics(vscode.window.activeTextEditor.document, collection);
    }
    context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) {
          updateDiagnostics(editor.document, collection);
        }
      })
    );
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(textDocument => {
        if (textDocument) {
          updateDiagnostics(textDocument, collection);
        }
      })
    );
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(textDocumentChangeEvent => {
        updateDiagnostics(textDocumentChangeEvent.document, collection);
      })
    );
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider("yaml", new ScaffoldCodeActionProvider(), {
        providedCodeActionKinds: ScaffoldCodeActionProvider.providedCodeActionKinds,
      })
    );
  }

  const ocSdkCmd = new OcSdkCommand();
  const ocCmd = new OcCommand();
  const session = new Session(ocSdkCmd);

  await session.validateOcSDKInstallation();
  await session.validateOpenShiftAccess();
  await session.validateZosCloudBrokerInstallation();
  await session.determinateOcSdkIsOutdated();
  const outputChannel = vscode.window.createOutputChannel("IBM Operator Collection SDK");

  const operatorTreeProvider = new OperatorsTreeProvider(session);
  const resourceTreeProvider = new ResourcesTreeProvider(session);
  const openshiftTreeProvider = new OpenShiftTreeProvider(session);
  const aboutProvider = new AboutTreeProvider(session);
  const linksTreeProvider = new LinksTreeProvider();
  const containerLogProvider = new ContainerLogProvider(session);
  const verboseContainerLogProvider = new VerboseContainerLogProvider(session);
  const customResourceDisplayProvider = new CustomResourceDisplayProvider(session);

  // Register Providers
  vscode.window.registerTreeDataProvider(VSCodeViewIds.operators, operatorTreeProvider);
  vscode.window.registerTreeDataProvider(VSCodeViewIds.resources, resourceTreeProvider);
  vscode.window.registerTreeDataProvider(VSCodeViewIds.help, linksTreeProvider);
  vscode.window.registerTreeDataProvider(VSCodeViewIds.openshiftClusterInfo, openshiftTreeProvider);
  vscode.window.registerTreeDataProvider(VSCodeViewIds.about, aboutProvider);
  vscode.workspace.registerTextDocumentContentProvider(util.logScheme, containerLogProvider);
  vscode.workspace.registerTextDocumentContentProvider(util.verboseLogScheme, verboseContainerLogProvider);
  vscode.workspace.registerTextDocumentContentProvider(util.customResourceScheme, customResourceDisplayProvider);

  // Register Commands
  vscode.commands.executeCommand("setContext", VSCodeCommands.sdkInstalled, await session.validateOcSDKInstallation());
  vscode.commands.executeCommand("setContext", VSCodeCommands.loggedIn, await session.validateOpenShiftAccess());
  vscode.commands.executeCommand("setContext", VSCodeCommands.validNamespace, await session.validateNamespaceExist());
  vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion, await session.determinateOcSdkIsOutdated());
  vscode.commands.executeCommand("setContext", VSCodeCommands.zosCloudBrokerInstalled, await session.validateZosCloudBrokerInstallation());
  context.subscriptions.push(logIn(VSCodeCommands.login, ocCmd, session));
  context.subscriptions.push(logOut(VSCodeCommands.logout, ocCmd, session));
  context.subscriptions.push(installOcSdk(VSCodeCommands.install, ocSdkCmd, session, outputChannel));
  context.subscriptions.push(updateOcSdkVersion(VSCodeCommands.sdkUpgradeVersion, ocSdkCmd, session, outputChannel));
  context.subscriptions.push(updateProject(VSCodeCommands.updateProject, ocCmd, session));
  context.subscriptions.push(executeSdkCommandWithUserInput(VSCodeCommands.createOperator, session, outputChannel));
  context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.deleteOperator, session, outputChannel));
  context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.redeployCollection, session, outputChannel));
  context.subscriptions.push(executeSimpleSdkCommand(VSCodeCommands.redeployOperator, session, outputChannel));
  context.subscriptions.push(deleteCustomResource(VSCodeCommands.deleteCustomResource, session));
  context.subscriptions.push(executeContainerViewLogCommand(VSCodeCommands.viewLogs, session));
  context.subscriptions.push(executeCustomResourceViewLogCommand(VSCodeCommands.viewVerboseLogs, session));
  context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openEditLink));
  context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openAddLink));
  context.subscriptions.push(executeOpenLinkCommand(VSCodeCommands.openLink));
  context.subscriptions.push(viewResourceCommand(VSCodeCommands.viewResource, session));
  context.subscriptions.push(executeInlineReplaceWith(VSCodeCommands.inlineReplaceWith));
  context.subscriptions.push(createFile(VSCodeCommands.createFile));
  context.subscriptions.push(convertToAirgapCollection(VSCodeCommands.convertToAirgapCollection, outputChannel));
  context.subscriptions.push(createGalaxyBoilerplateFile(VSCodeCommands.createGalaxyBoilerplateFile));
  context.subscriptions.push(createOperatorConfigBoilerplateFile(VSCodeCommands.createOperatorConfigBoilerplateFile));
  context.subscriptions.push(createPlaybookBoilerplateFile(VSCodeCommands.createPlaybookBoilerplateFile));
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refresh, () => {
      session
        .update(true)
        .then(() => {
          operatorTreeProvider.refresh();
          resourceTreeProvider.refresh();
          aboutProvider.refresh();
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure updating session: ${e}`);
        });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.resourceRefresh, () => {
      session
        .update(false)
        .then(proceed => {
          if (proceed) {
            resourceTreeProvider.refresh();
          }
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure updating session: ${e}`);
        });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refreshAll, () => {
      session
        .update(true)
        .then(() => {
          openshiftTreeProvider.refresh();
          operatorTreeProvider.refresh();
          resourceTreeProvider.refresh();
          aboutProvider.refresh();
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure updating session: ${e}`);
        });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refreshOpenShiftInfo, () => {
      session
        .update(false)
        .then(proceed => {
          if (proceed) {
            openshiftTreeProvider.refresh();
          }
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure updating session: ${e}`);
        });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refreshContainerLog, (uri: vscode.Uri) => {
      session
        .update()
        .then(proceed => {
          if (proceed) {
            containerLogProvider.refresh(uri);
          }
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure updating session: ${e}`);
        });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.refreshVerboseContainerLog, (uri: vscode.Uri) => {
      session
        .update()
        .then(proceed => {
          if (proceed) {
            verboseContainerLogProvider.refresh(uri);
          }
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure updating session: ${e}`);
        });
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(VSCodeCommands.sdkUpgradeVersionSkip, () => {
      session.setSkipOcSdkVersionUpdateFlag().then(() => {
        session.determinateOcSdkIsOutdated().then(isOutdated => {
          vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion, isOutdated);
          vscode.commands.executeCommand(VSCodeCommands.refresh);
        });
      });
    })
  );
}

function executeInlineReplaceWith(command: string) {
  return vscode.commands.registerCommand(command, async (refactorText: string, document: vscode.TextDocument, range: vscode.Range) => {
    try {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, range, refactorText);
      vscode.workspace.applyEdit(edit);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to edit "${path.basename(document.uri.fsPath)}": ${e}`);
    }
  });
}

function createFile(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (filename: string, directory: string) => {
    let content: string = "";
    let counterFile: string = "";
    const operatorConfigRX = /operator-config\.ya?ml$/;
    const galaxyRX = /galaxy\.ya?ml$/;
    const playbookRX = /\.ya?ml$/;

    if (operatorConfigRX.test(filename)) {
      let name = "AddNameHere";
      let domain = "AddDomainHere";
      let version = "AddVersionHere";
      // check if galaxy file exists in this collection
      const galaxyFile = workspace.getMatchingDecendants(directory, [/galaxy.ya?ml$/], false);
      if (galaxyFile.length) {
        // if a galaxy file exists, populate the operator-config file with shared values
        const sharedValues = workspace.getValuesFromYamlFile(galaxyFile[0], ["name", "namespace", "version"]);
        name = sharedValues[0] ?? name;
        domain = sharedValues[1] ?? domain;
        version = sharedValues[2] ?? version;
      } else {
        // note that the galaxy file doesn't exist
        counterFile = "galaxy.yml";
      }

      content = BoilerplateContent.operatorConfigBoilerplateContent(name, domain, version);
    } else if (galaxyRX.test(filename)) {
      let name = "AddNameHere";
      let namespace = "AddDomainHere";
      let version = "AddVersionHere";
      // check if an operator-config file exists in this collection
      const operatorConfigFile = workspace.getMatchingDecendants(directory, [/operator-config.ya?ml$/], false);
      if (operatorConfigFile.length) {
        // if an operator-config exists, populate the galaxy file with shared values
        const sharedValues = workspace.getValuesFromYamlFile(operatorConfigFile[0], ["name", "domain", "version"]);
        name = sharedValues[0] ?? name;
        namespace = sharedValues[1] ?? namespace;
        version = sharedValues[2] ?? version;
      } else {
        // note that the operator-config file doesn't exist
        counterFile = "operator-config.yml";
      }

      content = BoilerplateContent.galaxyBoilerplateContent(name, namespace, version);
    } else if (playbookRX.test(filename)) {
      content = BoilerplateContent.playbookBoilerplateContent;
    } else {
      vscode.window.showErrorMessage(`Cannot create scaffold for file ${filename}. Supported file types are: .yaml/.yml`);
      return;
    }

    // save fileName extension and strip filePath of extension
    const extension = filename.match(playbookRX)?.[0];
    let filePath = path.join(directory, filename).replace(playbookRX, "");

    // we need to check if either "*.yaml" or "*.yml" versions exist
    // if it does, use the file extension they prefer
    let fileExists: boolean = false;
    if (fs.existsSync(filePath + ".yaml")) {
      fileExists = true;
      filePath = filePath + ".yaml";
    } else if (fs.existsSync(filePath + ".yml")) {
      fileExists = true;
      filePath = filePath + ".yml";
    } else {
      filePath = filePath + extension;
    }

    // if the file exists, ask user for permision to overwrite
    if (fileExists) {
      const canProceed = await vscode.window.showInformationMessage(
        `
        A(n) ${filename} file already exists in this location: "${path.basename(path.dirname(filePath))}"

        Do you want to overwrite it?
        `, // preserve whitespace
        { modal: true },
        "Yes"
      );
      if (!canProceed || canProceed !== "Yes") {
        return;
      }
    }

    try {
      // if filename contains additional directories that don't exist, create them
      const additionalDirectories = path.dirname(filename);
      if (!fs.existsSync(path.join(directory, additionalDirectories))) {
        fs.mkdirSync(path.join(directory, additionalDirectories), { recursive: true });
      }
      fs.writeFileSync(filePath, content, "utf-8");
      vscode.window.showInformationMessage(`Successfully created file ${filename}.`);

      // if the counter file doesn't exist ask the user if they want to create one
      if (counterFile) {
        const createCounterFile = await vscode.window.showInformationMessage(
          `
          We noticed the operator collection "${path.basename(path.dirname(filePath))}" is missing a required file: ${counterFile}. 
          
          Would you like to create one now?
          `, // preserve whitespace
          { modal: true },
          "Yes"
        );

        if (!createCounterFile || createCounterFile !== "Yes") {
          return;
        }
        vscode.commands.executeCommand(VSCodeCommands.createFile, counterFile, directory);
      }
    } catch (e) {
      if (e) {
        const msg = `Error attempting to create file ${filename}: ${e}`;
        vscode.window.showErrorMessage(msg);
      }
    }
  });
}

function createGalaxyBoilerplateFile(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(command, async uri => {
    const filename = "galaxy.yml";
    if (uri) {
      const candidateDirectory = uri.fsPath;
      const [collectionDirectory, collectionPathIsAmbiguous] = workspace.findNearestCollectionRoot(candidateDirectory);
      if (collectionPathIsAmbiguous) {
        vscode.window.showWarningMessage(`
          The folder "${path.basename(candidateDirectory)}" contains multiple collections. 
          Select a specific collection to create a ${filename} file.
        `);
        return;
      }

      const destinationDirectory = collectionDirectory ? collectionDirectory : candidateDirectory;
      if (destinationDirectory !== candidateDirectory) {
        vscode.window.showWarningMessage(`
          Attempting to create file at "${path.basename(destinationDirectory)}" instead of "${path.basename(candidateDirectory)}"; 
          Each collection should contain exactly one ${filename} file, and collections cannot be nested.
        `);
      }
      vscode.commands.executeCommand(VSCodeCommands.createFile, filename, destinationDirectory);
    } else {
      vscode.window.showErrorMessage(`Failed to create ${filename} file, please try again.`);
    }
  });
}

function createOperatorConfigBoilerplateFile(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(command, async uri => {
    const filename = "operator-config.yml";
    if (uri) {
      const candidateDirectory = uri.fsPath;
      const [collectionDirectory, collectionPathIsAmbiguous] = workspace.findNearestCollectionRoot(candidateDirectory);
      if (collectionPathIsAmbiguous) {
        vscode.window.showWarningMessage(`
          The folder "${path.basename(candidateDirectory)}" contains multiple collections. 
          Select a specific collection to create a ${filename} file.
        `);
        return;
      }

      const destinationDirectory = collectionDirectory ? collectionDirectory : candidateDirectory;
      if (destinationDirectory !== candidateDirectory) {
        vscode.window.showWarningMessage(`
          Attempting to create file at "${path.basename(destinationDirectory)}" instead of "${path.basename(candidateDirectory)}"; 
          Each collection should contain exactly one ${filename} file, and collections cannot be nested.
        `);
      }
      vscode.commands.executeCommand(VSCodeCommands.createFile, filename, destinationDirectory);
    } else {
      vscode.window.showErrorMessage(`Failed to create ${filename} file, please try again.`);
    }
  });
}

function createPlaybookBoilerplateFile(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(command, async uri => {
    const filename = "playbook.yml";
    if (uri) {
      const directory = uri.fsPath;
      vscode.commands.executeCommand(VSCodeCommands.createFile, filename, directory);
    } else {
      vscode.window.showErrorMessage(`Failed to create ${filename} file, please try again.`);
    }
  });
}

function initCollectionAtFolder(command: string, outputChannel?: vscode.OutputChannel) {
  return vscode.commands.registerCommand(command, async uri => {
    const workspaceFolder = workspace.getCurrentWorkspaceRootFolder();
    const rootFolder = workspaceFolder ? path.basename(workspaceFolder) : workspaceFolder;
    if (rootFolder) {
      const directory = uri.fsPath;

      // if any decendants of this directory is a collection that means this directory
      // is an "operator collection workspace". However if any parents are collections
      // the user is attempting to create a nested collection, which is not allowed
      const fileExtensions = [".yaml", ".yml"];
      const targets = [/galaxy.ya?ml$/, /operator-config.ya?ml$/];
      const parentCollectionPath = workspace.searchParents(directory, rootFolder, targets, fileExtensions);
      if (parentCollectionPath !== "") {
        vscode.window.showWarningMessage(`You are attempting to create a nested collection at "${path.basename(directory)}", which is not allowed.`);
        return;
      }

      // TODO: Merge Mariandrea's changes
    }
  });
}

function convertToAirgapCollection(command: string, outputChannel?: vscode.OutputChannel) {
  return vscode.commands.registerCommand(command, async uri => {
    const workspaceFolder = workspace.getCurrentWorkspaceRootFolder();
    const rootFolder = workspaceFolder ? path.basename(workspaceFolder) : workspaceFolder;
    if (rootFolder && uri) {
      const directory = uri.fsPath;

      // determine which collection to convert based on the uri clicked
      const [nearestCollection, collectionPathIsAmbiguous] = workspace.findNearestCollectionRoot(directory);
      if (nearestCollection === "") {
        if (collectionPathIsAmbiguous) {
          vscode.window.showWarningMessage(`
            The folder "${path.basename(directory)}" contains multiple collections. 
            Select a specific collection to create convert to an airgap collection.
          `);
        } else {
          vscode.window.showWarningMessage(`The folder "${path.basename(directory)}" does not contain any collections.`);
        }
        return;
      }

      // ensure the nearest collection path is an ancestor path or decendant path
      if (!workspace.pathIsAncestorOrDecendant(directory, nearestCollection)) {
        vscode.window.showWarningMessage(`This folder doesn't contain any collections. Did you mean to convert "${path.basename(nearestCollection)}" instead?`);
        return;
      }

      // validate the requirements file exists
      const collectionRequirements = workspace.getMatchingDecendants(nearestCollection, [/requirements.ya?ml/], true, [".yaml", ".yml"]);
      if (collectionRequirements.length === 0) {
        vscode.window.showWarningMessage(`
          No requirements.yml file detected within the collection "${path.basename(nearestCollection)}". 
          Airgap conversion requires a "collections/requirements.yml" file.
        `);
        return;
      }

      vscode.window.showInformationMessage(`Converting \"${path.basename(nearestCollection)}\" to an airgap collection...`);
      try {
        let ocSdkCommand = new OcSdkCommand(nearestCollection);
        outputChannel?.show();
        await ocSdkCommand.runCreateOfflineRequirements(outputChannel).then(() => {
          vscode.window.showInformationMessage(`Successfully converted \"${path.basename(nearestCollection)}\" to an airgap collection`);
        });
      } catch (e) {
        vscode.window.showErrorMessage('The Operator Collection SDK command "create_offline_requirements" failed convert collection. Please see output for more details.');
      }
    }
  });
}

function installOcSdk(command: string, ocSdkCmd: OcSdkCommand, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (logPath?: string) => {
    try {
      await ocSdkCmd.runCollectionVerifyCommand(undefined, logPath);
      session.ocSdkInstalled = true;
    } catch (e) {
      session.ocSdkInstalled = false;
    }
    if (session.ocSdkInstalled) {
      vscode.window.showInformationMessage("IBM Operator Collection SDK already installed");
      vscode.commands.executeCommand(VSCodeCommands.refresh);
    } else {
      outputChannel?.show();
      vscode.window.showInformationMessage("Installing the IBM Operator Collection SDK");

      Promise.all([ocSdkCmd.installOcSDKDependencies(outputChannel, logPath), ocSdkCmd.installOcSDKCommand(outputChannel, logPath)])
        .then(() => {
          session.ocSdkInstalled = true;
          vscode.window.showInformationMessage("Successfully installed the IBM Operator Collection SDK");
          vscode.commands.executeCommand("setContext", VSCodeCommands.sdkInstalled, session.ocSdkInstalled);
          vscode.commands.executeCommand(VSCodeCommands.refresh);
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure installing the IBM Operator Collection SDK: ${e}`);
        });
    }
  });
}

function updateOcSdkVersion(command: string, ocSdkCmd: OcSdkCommand, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (logPath?: string) => {
    try {
      vscode.window.showInformationMessage("Upgrading the IBM Operator Collection SDK to the latest version available in galaxy server");
      outputChannel?.show();
      vscode.window.showInformationMessage("Installing the IBM Operator Collection SDK");
      ocSdkCmd
        .upgradeOCSDKtoLatestVersion(outputChannel)
        .then(async () => {
          vscode.window.showInformationMessage("Successfully upgraded to the latest IBM Operator Collection SDK available in galaxy server");
          vscode.commands.executeCommand(VSCodeCommands.refreshAll);
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure upgrading to the latest IBM Operator Collection SDK: ${e}`);
        });
    } catch (e) {
      vscode.window.showErrorMessage(`Failure upgrading the IBM Operator Collection SDK: ${e}`);
      vscode.commands.executeCommand("setContext", VSCodeCommands.sdkOutdatedVersion, await session.determinateOcSdkIsOutdated());
      vscode.commands.executeCommand(VSCodeCommands.refresh);
    }
  });
}

function updateProject(command: string, ocCmd: OcCommand, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (arg: OpenShiftItem, logPath?: string) => {
    if (session.operationPending) {
      vscode.window.showWarningMessage("Please wait for the current operation to finish before switching projects.");
      return;
    }

    session
      .update(false, true)
      .then(async () => {
        if (session.loggedIntoOpenShift) {
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
                vscode.window.showInformationMessage("Successfully updating Project on OpenShift cluster");
                vscode.commands.executeCommand(VSCodeCommands.refreshAll);
              })
              .catch(e => {
                vscode.window.showErrorMessage(`Failure updating Project on OpenShift cluster: ${e}`);
              });
          }
        }
      })
      .catch(e => {
        vscode.window.showErrorMessage(`Failure updating session: ${e}`);
      });
  });
}

function logIn(command: string, ocCmd: OcCommand, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (openshiftItem: OpenShiftItem, params: string[], logPath?: string) => {
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
          vscode.window.showInformationMessage("Successfully logged into OpenShift cluster");
          vscode.commands.executeCommand(VSCodeCommands.refreshAll);
        })
        .catch(e => {
          session.loggedIntoOpenShift = false;
          vscode.window.showErrorMessage(`Failure logging into OpenShift cluster: ${e}`);
        });
    }
  });
}

function logOut(command: string, ocCmd: OcCommand, session: Session): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (outputChannel?: vscode.OutputChannel, logPath?: string) => {
    if (session.loggedIntoOpenShift) {
      if (session.operationPending) {
        vscode.window.showWarningMessage("Please wait for the current operation to finish before logging out of your current cluster.");
        return;
      }

      ocCmd
        .runOcLogoutCommand(outputChannel, logPath)
        .then(async () => {
          vscode.window.showInformationMessage("Successfully logged out of OpenShift cluster");
          vscode.commands.executeCommand("setContext", VSCodeCommands.loggedIn, true);
          vscode.commands.executeCommand(VSCodeCommands.refreshAll);
        })
        .catch(e => {
          vscode.window.showErrorMessage(`Failure logging out of OpenShift cluster: ${e}`);
        });
    }
  });
}

type CustomResources = ZosEndpointsItem | SubOperatorConfigsItem | OperatorCollectionsItem | CustomResourceItem | CustomResourcesItem;
function executeOpenLinkCommand(command: string): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (args: CustomResources | LinkItem | string) => {
    if (args) {
      let linkUri = typeof args === "string" ? vscode.Uri.parse(args) : vscode.Uri.parse(args.link);
      try {
        await vscode.env.openExternal(linkUri);
      } catch (e) {
        vscode.window.showErrorMessage(`Failure opening external link: ${e}`);
      }
    } else {
      vscode.window.showWarningMessage("Unable to open link while tree view is refreshing. Please try again in a few seconds.");
    }
  });
}

function viewResourceCommand(command: string, session: Session): vscode.Disposable {
  return vscode.commands.registerCommand(command, (args: CustomResources) => {
    session
      .update()
      .then(proceed => {
        if (proceed) {
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
            vscode.window.showWarningMessage("Unable to view resource while operation is pending.");
            return;
          }
          const uri = util.buildCustomResourceUri(kind!, instanceName!, group!, apiVersion!);
          vscode.workspace.openTextDocument(uri).then(doc => {
            vscode.window.showTextDocument(doc, { preview: false }).then(() => {
              vscode.languages.setTextDocumentLanguage(doc, "yaml");
            });
          });
        }
      })
      .catch(e => {
        vscode.window.showErrorMessage(`Failure updating session: ${e}`);
      });
  });
}

function executeContainerViewLogCommand(command: string, session: Session): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (containerItemArgs: OperatorContainerItem, logPath?: string) => {
    session
      .update()
      .then(async proceed => {
        if (proceed) {
          if (containerItemArgs) {
            const logUri = util.buildContainerLogUri(containerItemArgs.podObj.metadata?.name!, containerItemArgs.containerStatus.name);
            const doc = await vscode.workspace.openTextDocument(logUri);
            await vscode.window.showTextDocument(doc, {
              preview: false,
            });
            vscode.commands.executeCommand("iliazeus.vscode-ansi.showPretty");
            vscode.commands.executeCommand(VSCodeCommands.refreshContainerLog, logUri);
          } else {
            vscode.window.showWarningMessage("Please wait for the operator to finish loading, then try again.");
          }
        }
      })
      .catch(e => {
        vscode.window.showErrorMessage(`Failure updating session: ${e}`);
      });
  });
}

function executeCustomResourceViewLogCommand(command: string, session: Session): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (customResourcesItemArgs: CustomResourcesItem, logPath?: string) => {
    session
      .update()
      .then(async proceed => {
        if (proceed && customResourcesItemArgs !== undefined) {
          console.log("OperatorName: " + customResourcesItemArgs);
          const operatorItem = OperatorItem.getOperatorItemByName(customResourcesItemArgs.operatorName);
          let podName: string = "";
          let containerName: string = "";
          if (operatorItem?.podItems.length === 0) {
            vscode.window.showErrorMessage("Failure retrieving logs because operator pod doesn't exist");
            return;
          }
          const podItem = operatorItem?.podItems.find(item => {
            if (item.podObj.status?.containerStatuses) {
              for (const containerStatus of item.podObj.status?.containerStatuses) {
                if (!containerStatus.name.startsWith("init") && containerStatus.state !== containerStatus.state?.terminated) {
                  return item;
                }
              }
            }
          });

          if (podItem !== undefined) {
            if (podItem.podObj.metadata?.name !== undefined) {
              podName = podItem.podObj.metadata?.name;
            }
            if (podItem.podObj.status?.containerStatuses !== undefined) {
              for (const container of podItem.podObj.status?.containerStatuses) {
                if (!container.name.startsWith("init")) {
                  containerName = container.name;
                }
              }
            }
            if (podName === "") {
              vscode.window.showErrorMessage("Unabled to determine Pod name for corresponding instance");
              return;
            } else if (containerName === "") {
              vscode.window.showErrorMessage("Unabled to determine container name for corresponding instance");
              return;
            } else {
              const logUri = util.buildVerboseContainerLogUri(podName, containerName, customResourcesItemArgs.customResourceObj.apiVersion.split("/")[1], customResourcesItemArgs.customResourceObj.kind, customResourcesItemArgs.customResourceObj.metadata.name);
              try {
                const doc = await vscode.workspace.openTextDocument(logUri);
                await vscode.window.showTextDocument(doc, {
                  preview: false,
                });
                vscode.commands.executeCommand("iliazeus.vscode-ansi.showPretty");
                vscode.commands.executeCommand(VSCodeCommands.refreshVerboseContainerLog, logUri);
              } catch (e) {
                return;
              }
            }
          } else {
            vscode.window.showWarningMessage("Unable to retrieve logs while operator pod is initializing");
          }
        }
      })
      .catch(e => {
        vscode.window.showErrorMessage(`Failure updating session: ${e}`);
      });
  });
}

/**
 * Executes a simple command without user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSimpleSdkCommand(command: string, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (operatorItemArg: OperatorItem, logPath?: string) => {
    if (session.operationPending) {
      vscode.window.showWarningMessage("Please wait for the current operation to finish before starting another.");
      return;
    }

    session
      .update()
      .then(async proceed => {
        if (proceed) {
          let workspacePath: string | undefined = "";
          if (operatorItemArg) {
            workspacePath = operatorItemArg.workspacePath;
          } else {
            let pwd = workspace.getCurrentWorkspaceRootFolder();
            if (pwd) {
              workspacePath = await util.selectOperatorInWorkspace(pwd);
              workspacePath = path.parse(workspacePath!).dir;
            }
          }
          if (workspacePath) {
            const validNamespace = session.validNamespace;
            if (validNamespace) {
              session.operationPending = true;
              let ocSdkCommand = new OcSdkCommand(workspacePath);
              outputChannel?.show();
              switch (command) {
                case VSCodeCommands.deleteOperator: {
                  vscode.window.showInformationMessage("Delete Operator request in progress");
                  const poll = util.pollRun(10);
                  const runDeleteOperatorCommand = ocSdkCommand.runDeleteOperatorCommand(outputChannel, logPath);
                  Promise.all([poll, runDeleteOperatorCommand])
                    .then(() => {
                      session.operationPending = false;
                      vscode.window.showInformationMessage("Delete Operator command executed successfully");
                      vscode.commands.executeCommand(VSCodeCommands.refresh);
                    })
                    .catch(e => {
                      session.operationPending = false;
                      vscode.window.showErrorMessage(`Failure executing Delete Operator command: RC ${e}`);
                    });
                  break;
                }
                case VSCodeCommands.redeployCollection: {
                  vscode.window.showInformationMessage("Redeploy Collection request in progress");
                  const poll = util.pollRun(30);
                  const runRedeployCollectionCommand = ocSdkCommand.runRedeployCollectionCommand(outputChannel, logPath).then(() => {
                    session.operationPending = false;
                  });
                  Promise.all([poll, runRedeployCollectionCommand])
                    .then(() => {
                      session.operationPending = false;
                      vscode.window.showInformationMessage("Redeploy Collection command executed successfully");
                      vscode.commands.executeCommand(VSCodeCommands.refresh);
                    })
                    .catch(e => {
                      session.operationPending = false;
                      vscode.window.showErrorMessage(`Failure executing Redeploy Collection command: RC ${e}`);
                    });
                  break;
                }
                case VSCodeCommands.redeployOperator: {
                  vscode.window.showInformationMessage("Redeploy Operator request in progress");
                  const poll = util.pollRun(40);
                  const runRedeployOperatorCommand = ocSdkCommand.runRedeployOperatorCommand(outputChannel, logPath).then(() => {
                    session.operationPending = false;
                  });
                  Promise.all([poll, runRedeployOperatorCommand])
                    .then(() => {
                      session.operationPending = false;
                      vscode.window.showInformationMessage("Redeploy Operator command executed successfully");
                      vscode.commands.executeCommand(VSCodeCommands.refresh);
                    })
                    .catch(e => {
                      session.operationPending = false;
                      vscode.window.showErrorMessage(`Failure executing Redeploy Operator command: RC ${e}`);
                    });
                  break;
                }
              }
            }
          }
        }
      })
      .catch(e => {
        vscode.window.showErrorMessage(`Failure updating session: ${e}`);
      });
  });
}

/**
 * Executes a command that requires user input
 * @param command — The VS Code command to execute
 * @returns - The vscode.Disposable class
 */
function executeSdkCommandWithUserInput(command: string, session: Session, outputChannel?: vscode.OutputChannel): vscode.Disposable {
  return vscode.commands.registerCommand(command, async (operatorItemArg: OperatorItem, logPath?: string) => {
    if (session.operationPending) {
      vscode.window.showWarningMessage("Please wait for the current operation to finish before starting another.");
      return;
    }
    session.update().then(async proceed => {
      if (proceed) {
        let workspacePath: string | undefined = "";
        if (operatorItemArg) {
          workspacePath = operatorItemArg.workspacePath;
        } else {
          let pwd = workspace.getCurrentWorkspaceRootFolder();
          if (pwd) {
            workspacePath = await util.selectOperatorInWorkspace(pwd);
            workspacePath = path.parse(workspacePath!).dir;
          }
        }
        if (workspacePath) {
          const validNamespace = session.validNamespace;
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
                session.operationPending = true;
                Promise.all([
                  util.pollRun(40),
                  ocSdkCommand.runCreateOperatorCommand(playbookArgs, outputChannel, logPath).then(() => {
                    session.operationPending = false;
                  }),
                ])
                  .then(() => {
                    session.operationPending = false;
                    vscode.window.showInformationMessage("Create Operator command executed successfully");
                    vscode.commands.executeCommand(VSCodeCommands.refresh);
                  })
                  .catch(e => {
                    session.operationPending = false;
                    vscode.window.showErrorMessage(`Failure executing Create Operator command: RC ${e}`);
                  });
              }
            }
          }
        }
      }
    });
  });
}

function deleteCustomResource(command: string, session: Session) {
  return vscode.commands.registerCommand(command, async (customResourcArg: CustomResourcesItem) => {
    session
      .update()
      .then(async proceed => {
        if (proceed) {
          if (customResourcArg) {
            const k8s = new KubernetesObj();
            const validNamespace = session.validNamespace;
            if (validNamespace) {
              const name = customResourcArg.customResourceObj.metadata.name;
              const apiVersion = customResourcArg.customResourceObj.apiVersion.split("/")[1];
              const kind = customResourcArg.customResourceObj.kind;
              const poll = util.pollRun(15);
              const deleteCustomResourceCmd = k8s.deleteCustomResource(name, apiVersion, kind);
              Promise.all([poll, deleteCustomResourceCmd])
                .then(values => {
                  const deleteSuccessful = values[1];
                  if (deleteSuccessful) {
                    vscode.window.showInformationMessage(`Successfully deleted ${kind} resource`);
                    vscode.commands.executeCommand(VSCodeCommands.resourceRefresh);
                  } else {
                    vscode.window.showErrorMessage(`Failed to delete ${kind} resource`);
                  }
                })
                .catch(e => {
                  vscode.window.showErrorMessage(`Failed to delete ${kind} resource: ${e}`);
                });
            }
          } else {
            vscode.window.showErrorMessage("Failed to delete custom resource. Please try again.");
          }
        }
      })
      .catch(e => {
        vscode.window.showErrorMessage(`Failure updating session: ${e}`);
      });
  });
}

async function updateDiagnostics(document: vscode.TextDocument, collection: vscode.DiagnosticCollection): Promise<void> {
  if ((document && path.basename(document.uri.fsPath) === "operator-config.yaml") || path.basename(document.uri.fsPath) === "operator-config.yml") {
    const configData = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];
    const operatorConfig = yaml.load(configData) as OperatorConfig;

    //Try to read the galaxy.yml or galaxy.yaml document
    let galaxyData;
    let galaxyConfig;
    try {
      galaxyData = fs.readFileSync(path.join(path.dirname(document.uri.fsPath), "galaxy.yaml"), "utf8");
      galaxyConfig = yaml.load(galaxyData) as AnsibleGalaxyYmlSchema;
    } catch (err) {}
    if (!galaxyData) {
      try {
        galaxyData = fs.readFileSync(path.join(path.dirname(document.uri.fsPath), "galaxy.yml"), "utf8");
        galaxyConfig = yaml.load(galaxyData) as AnsibleGalaxyYmlSchema;
      } catch (err) {
        diagnostics.push({
          range: new vscode.Range(document.positionAt(0), document.positionAt(0)),

          // provideCodeActions in scaffoldCodeActionProvider.ts relies on this error string, change with CAUTION
          message: VSCodeDiagnosticMessages.missingGalaxyFile,
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    }

    //Get document "symbols"
    //These are provided by the yaml extension
    //There is no way to check if the yaml extension has been loaded
    //So the only way to wait for it to load is to keep calling this
    //command until it succeeds.
    let docSymbols: any = undefined;
    while (!docSymbols) {
      docSymbols = (await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", document.uri)) as vscode.DocumentSymbol[];
      //[Optional] Sleep to be mindful and not overload the command queue
      if (!docSymbols) {
        await util.sleep(100);
      }
    }

    //If we succesfuly read the galaxy data we proceed to lint those features
    if (galaxyConfig !== undefined) {
      //Validate that operatorConfig values name, version, and domain match galaxy name, version, and namespace
      if (galaxyConfig.namespace && operatorConfig.domain && galaxyConfig.namespace.toLowerCase() !== operatorConfig.domain.toLowerCase()) {
        //Get domain symbol
        const domainSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "domain" && symbol.detail === operatorConfig.domain);
        if (domainSymbol) {
          diagnostics.push({
            range: domainSymbol.range,
            message: "Domain SHOULD match the namespace value specified in your galaxy.yml file, unless a fork/clone of an official Ansible Collection is desired.",
            severity: vscode.DiagnosticSeverity.Warning,
          });
        }
      }
      if (galaxyConfig.name && operatorConfig.name && galaxyConfig.name.toLowerCase().replace(/_/g, "-") !== operatorConfig.name.toLowerCase().replace(/_/g, "-")) {
        //Get name symbol
        const nameSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "name" && symbol.detail === operatorConfig.name);
        if (nameSymbol) {
          diagnostics.push({
            range: nameSymbol.range,
            message: "Name SHOULD match the name specified in your galaxy.yml file, unless a fork/clone of an official Ansible Collection is desired.",
            severity: vscode.DiagnosticSeverity.Warning,
          });
        }
      }
      if (galaxyConfig.version && operatorConfig.version && galaxyConfig.version !== operatorConfig.version) {
        //Get version symbol
        const versionSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "version" && symbol.detail === operatorConfig.version);
        if (versionSymbol) {
          diagnostics.push({
            range: versionSymbol.range,
            message: "Version SHOULD match the version specified in your galaxy.yml file.",
            severity: vscode.DiagnosticSeverity.Error,
          });
        }
      }
    }

    //Validate that an ansible config file does not exist or that it's listed in the build_ignore section of the galaxy.yml file
    try {
      fs.readFileSync(path.join(path.dirname(document.uri.fsPath), "ansible.cfg"), "utf8");
      if (!(galaxyConfig !== undefined && galaxyConfig.build_ignore?.find(ignore => ignore === "ansible.cfg"))) {
        diagnostics.push({
          range: new vscode.Range(document.positionAt(0), document.positionAt(0)),
          message: "Collection build MUST not contain an ansible.cfg file. Please delete it or add this file to the build_ignore section of the galaxy.yml file.",
          severity: vscode.DiagnosticSeverity.Error,
        });
      }
    } catch (err) {}

    //Validate that playbook and finalizer paths exist
    if (operatorConfig.resources) {
      //Get resources symbol
      const resourcesSymbol: vscode.DocumentSymbol | undefined = docSymbols.find((symbol: vscode.DocumentSymbol) => symbol.name === "resources");

      for (const resource of operatorConfig.resources) {
        //Get resource symbol
        const resourceSymbol = resourcesSymbol?.children.find((symbol: vscode.DocumentSymbol) => {
          return symbol.children.find((childSymbol: vscode.DocumentSymbol) => childSymbol.name === "kind" && childSymbol.detail === resource.kind);
        });
        //Validate Playbook
        if (resource.playbook) {
          //Get playbook symbol
          const resourcePlaybookSymbol = resourceSymbol?.children.find((symbol: vscode.DocumentSymbol) => symbol.name === "playbook" && symbol.detail === resource.playbook);
          //Check if path is absolute
          if (path.isAbsolute(resource.playbook)) {
            if (resourcePlaybookSymbol) {
              diagnostics.push({
                range: resourcePlaybookSymbol.range,
                message: `Playbook path MUST be relative to the root of the Operator Collection - ${resource.playbook}`,
                severity: vscode.DiagnosticSeverity.Error,
              });
            }
          } else {
            //Check if playbook exist
            try {
              fs.readFileSync(path.join(path.dirname(document.uri.fsPath), resource.playbook), "utf8");
              const playbookDoc = await vscode.workspace.openTextDocument(path.join(path.dirname(document.uri.fsPath), resource.playbook));
              //Get playbook "symbols"
              const playbookDocSymbols = (await vscode.commands.executeCommand("vscode.executeDocumentSymbolProvider", playbookDoc.uri)) as vscode.DocumentSymbol[];
              if (playbookDocSymbols !== undefined) {
                let plays: vscode.DocumentSymbol[] = [];

                playbookDocSymbols.forEach(symbol => {
                  const play = symbol.children.find(childSymbol => childSymbol.name === "hosts");
                  if (play) {
                    plays.push(play);
                  }
                });
                if (plays.some(play => play.detail !== "all")) {
                  if (resourcePlaybookSymbol) {
                    diagnostics.push({
                      range: resourcePlaybookSymbol.range,
                      message: `Playbook MUST use a "hosts: all" value. - ${resource.playbook}`,
                      severity: vscode.DiagnosticSeverity.Error,
                    });
                  }
                }
              }
            } catch (err) {
              if (resourcePlaybookSymbol) {
                diagnostics.push({
                  range: resourcePlaybookSymbol.range,

                  // provideCodeActions in scaffoldCodeActionProvider.ts relies on this error string, change with CAUTION
                  message: `${VSCodeDiagnosticMessages.invalidPlaybookError} ${resource.kind} - ${resource.playbook}`,
                  severity: vscode.DiagnosticSeverity.Error,
                });
              }
            }
          }
        }
        //Validate Finalizer
        if (resource.finalizer) {
          //Get finalizer symbol
          const resourceFinalizerymbol = resourceSymbol?.children.find((symbol: vscode.DocumentSymbol) => symbol.name === "finalizer" && symbol.detail === resource.finalizer);
          //Check if path is absolute
          if (path.isAbsolute(resource.finalizer)) {
            if (resourceFinalizerymbol) {
              diagnostics.push({
                range: resourceFinalizerymbol.range,
                message: `Finalizer playbook path MUST be relative to the root of the Operator Collection - ${resource.finalizer}`,
                severity: vscode.DiagnosticSeverity.Error,
              });
            }
          } else {
            try {
              fs.readFileSync(path.join(path.dirname(document.uri.fsPath), resource.finalizer), "utf8");
            } catch (err) {
              if (resourceFinalizerymbol) {
                diagnostics.push({
                  range: resourceFinalizerymbol.range,

                  // provideCodeActions in scaffoldCodeActionProvider.ts relies on this error string, change with CAUTION
                  message: `${VSCodeDiagnosticMessages.invalidFinalizerError} ${resource.kind} - ${resource.finalizer}`,
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
