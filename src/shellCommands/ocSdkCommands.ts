/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as child_process from "child_process";
import * as fs from "fs-extra";
import * as https from "https";
import * as http from "http";
import {getAnsibleGalaxySettings, AnsibleGalaxySettings} from "../utilities/util";

export class OcSdkCommand {
  constructor(private pwd?: string | undefined) {}

  /**
   * Executes the requested command
   * @param cmd - The command to be executed
   * @param args - The arguments to pass to the command
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise containing the the return code of the executed command
   */
  private async run(
    cmd: string,
    args?: Array<string>,
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
    callbackFunction?: (outputValue: string) => void,
  ): Promise<any> {
    process.env.PWD = this.pwd;
    let outputValue = "";

    const options: child_process.SpawnOptions = {
      cwd: this.pwd,
      env: process.env,
      shell: true,
      stdio: "pipe",
    };

    let childProcess: child_process.ChildProcess;

    if (args) {
      childProcess = child_process.spawn(cmd, args, options);
    } else {
      childProcess = child_process.spawn(cmd, options);
    }

    if (logPath) {
      let logStream = fs.createWriteStream(logPath, { flags: "a" });
      childProcess.stdout?.pipe(logStream);
      childProcess.stderr?.pipe(logStream);
    }

    childProcess.stdout?.on("data", (data) => {
      outputChannel?.appendLine(data);
      outputValue += data.toString();
    });

    childProcess.stderr?.on("data", (data) => {
      outputChannel?.appendLine(data);
    });

    return new Promise<string>((resolve: any, reject: any) => {
      childProcess.on("error", (error: Error) => {
        outputChannel?.appendLine(error.message);
        return reject(error.message);
      });
      childProcess.on("close", (code: number) => {
        if (code) {
          if (code !== 0) {
            return reject(code);
          }
        } else {
          if (callbackFunction !== undefined) {
            callbackFunction(outputValue);
          }
          return resolve(code);
        }
      });
    });
  }

  /**
   * Executes the collection verify command to validate the collection is installed
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async runCollectionVerifyCommand(
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<string> {
    const galaxyUrl = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyURL) as string;
    const galaxyNamespace = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyNamespace) as string;
    const cmd: string = "ansible-galaxy";
    let args: Array<string> = [
      "collection",
      "verify",
      "-s",
      galaxyUrl,
      `${galaxyNamespace}.operator_collection_sdk`,
    ];
    return this.run(cmd, args, outputChannel, logPath);
  }

  /**
   * Executes the collection install command to install the Operator Collection SDK
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async installOcSDKCommand(
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<string> {
    // ansible-galaxy collection install ibm.operator_collection_sdk
    const galaxyUrl = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyURL) as string;
    const galaxyNamespace = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyNamespace) as string;
    const cmd: string = "ansible-galaxy";
    let args: Array<string> = [
      "collection",
      "install",
      "-s",
      galaxyUrl,
      `${galaxyNamespace}.operator_collection_sdk`,
    ];
    return this.run(cmd, args, outputChannel, logPath);
  }

  /**
   * Determinate if the installed local collection is the same as the latest collection in galaxy server
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async runDeterminateOcSdkIsOutdated(
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<boolean> {
    const galaxyUrl = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyURL) as string;
    const galaxyNamespace = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyNamespace) as string;
    let versionInstalled = "";
    let latestVersion = "";

    // ansible-galaxy collection list | grep ibm.operator_collection_sdk
    const cmd: string = "ansible-galaxy";
    let args: Array<string> = [
      "collection",
      "list",
      "|",
      "grep",
      `${galaxyNamespace}.operator_collection_sdk`,
    ];

    let jsonData: any;
    try {
      jsonData = await getJsonData(galaxyUrl, galaxyNamespace);
    } catch (e) {
      vscode.window.showErrorMessage(
        `Failure retrieving data from Ansible Galaxy: ${e}`,
      );
    }
   
    latestVersion = jsonData?.data?.collection?.latest_version.version;

    let setVersionInstalled = (outputValue: string) => {
      versionInstalled = outputValue.split(" ")?.[1]; // item in [1] is the version
    };

    await this.run(cmd, args, outputChannel, logPath, setVersionInstalled);
    return new Promise<boolean>((resolve) =>
      resolve(!(versionInstalled === latestVersion)),
    );
  }

  /**
   * Upgrade a collection to the latest available version from the Galaxy server
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async upgradeOCSDKtoLatestVersion(
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<boolean> {
    // ansible-galaxy collection install ibm.operator_collection_sdk --upgrade
    const galaxyUrl = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyURL) as string;
    const galaxyNamespace = getAnsibleGalaxySettings(AnsibleGalaxySettings.ansibleGalaxyNamespace) as string;
    const cmd: string = "ansible-galaxy";
    let args: Array<string> = [
      "collection",
      "install",
      "-s",
      galaxyUrl,
      `${galaxyNamespace}.operator_collection_sdk`,
      "--upgrade",
    ];
    return this.run(cmd, args, outputChannel, logPath);
  }

  /**
   * Executes the Operator Collection SDK Create Operator command
   * @param args - The arguments to pass to the command
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async runCreateOperatorCommand(
    args: Array<string>,
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<any> {
    process.env.ANSIBLE_JINJA2_NATIVE = "true";
    const cmd: string = "ansible-playbook";
    args = args.concat("ibm.operator_collection_sdk.create_operator");
    return this.run(cmd, args, outputChannel, logPath);
  }

  /**
   * Executes the Operator Collection SDK Delete Operator command
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async runDeleteOperatorCommand(
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<string> {
    return this.executeSimpleCommand(
      "ibm.operator_collection_sdk.delete_operator",
      outputChannel,
      logPath,
    );
  }

  /**
   * Executes the Operator Collection SDK Redeploy Collection command
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async runRedeployCollectionCommand(
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<string> {
    return this.executeSimpleCommand(
      "ibm.operator_collection_sdk.redeploy_collection",
      outputChannel,
      logPath,
    );
  }

  /**
   * Executes the Operator Collection SDK Redeploy Operator command
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  async runRedeployOperatorCommand(
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<string> {
    return this.executeSimpleCommand(
      "ibm.operator_collection_sdk.redeploy_operator",
      outputChannel,
      logPath,
    );
  }

  /**
   * Executes an Operator Collection SDK command without additional arguments
   * @param command - The command to execute
   * @param outputChannel - The VS Code output channel to display command output
   * @param logPath - Log path to store command output
   * @returns - A Promise container the return code of the command being executed
   */
  private executeSimpleCommand(
    command: string,
    outputChannel?: vscode.OutputChannel,
    logPath?: string,
  ): Promise<any> {
    const cmd: string = "ansible-playbook";
    let args: Array<string> = [command];
    return this.run(cmd, args, outputChannel, logPath);
  }
}

async function getJsonData(galaxyUrl: string, galaxyNamespace: string): Promise<any> {
  let jsonData: any;
  const urlScheme = vscode.Uri.parse(galaxyUrl).scheme;
  if (urlScheme === "https") {
    jsonData = await new Promise((resolve, reject) => {
      https
        .get(
          getApiUrl(galaxyUrl, galaxyNamespace),
          (resp) => {
            let data = "";
            resp.on("data", (chunk) => {
              data += chunk;
            });
            if (resp.statusCode === 200) {
              resp.on("end", () => {
                resolve(JSON.parse(data));
              });
            } else {
              resp.on("end", () => {
                reject(data);
              });
            }
          },
        )
        .on("error", (err) => {
          reject(err);
        });
    });
  } else if (urlScheme === "http") {
    jsonData = await new Promise((resolve, reject) => {
      http
        .get(
          getApiUrl(galaxyUrl, galaxyNamespace),
          (resp) => {
            let data = "";
            resp.on("data", (chunk) => {
              data += chunk;
            });
            if (resp.statusCode === 200) {
              resp.on("end", () => {
                resolve(JSON.parse(data));
              });
            } else {
              resp.on("end", () => {
                reject(data);
              });
            }
          },
        )
        .on("error", (err) => {
          reject(err);
        });
    });
  }
  return jsonData;
}

function getApiUrl(galaxyUrl: string, galaxyNamespace: string): string {
  return `${galaxyUrl}/api/internal/ui/repo-or-collection-detail/?namespace=${galaxyNamespace}&name=operator_collection_sdk`;
  "https://galaxy.ansible.com/api/v3/plugin/ansible/content/published/collections/index/ibm/operator_collection_sdk/versions/";
}