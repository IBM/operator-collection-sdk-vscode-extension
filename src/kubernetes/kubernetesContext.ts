import * as vscode from "vscode";
import * as path from "path";
import * as k8s from "@kubernetes/client-node";
import * as fs from "fs";
import { VSCodeCommands } from "../utilities/commandConstants";
import { OcCommand } from "../shellCommands/ocCommand";

export class KubernetesContext {
  public coreV1Api: k8s.CoreV1Api | undefined = undefined;
  public customObjectsApi: k8s.CustomObjectsApi | undefined = undefined;
  public namespace: string = "";
  public openshiftServerURL: string | undefined = "";
  constructor(namespace?: string) {
    const kc = new k8s.KubeConfig();
    if (namespace === undefined) {
      if (fs.existsSync("/var/run/secrets/kubernetes.io/serviceaccount")) {
        kc.loadFromCluster();
        this.namespace = fs.readFileSync("/var/run/secrets/kubernetes.io/serviceaccount/namespace").toString();
      } else {
        kc.loadFromDefault();
        if (kc.currentContext) {
          const currentContextObj = kc.getContextObject(kc.currentContext);
          if (currentContextObj?.namespace) {
            this.namespace = currentContextObj.namespace;
          }
        }
      }
    } else {
      kc.loadFromDefault();
      this.namespace = namespace;
    }

    // if the KubeConfig file doesn't exist, kc.loadFromDefault()
    // will provide a dummy context that must be caught
    const homeDirPath = k8s.findHomeDir();
    const kcPath = homeDirPath ? path.join(homeDirPath, ".kube", "config") : path.join(".kube", "config");
    if (!fs.existsSync(kcPath) || !kc.currentContext || kc.currentContext === "loaded-context") {
      // If kc is still empty, the Kube Config file is likely invalid
      vscode.window.showWarningMessage("Your KubeConfig file has not been properly configured.");

      // Prompt OC login
      const ocCmd = new OcCommand();
      this.attemptOCLogin(ocCmd).then(loggedIn => {
        if (loggedIn) {
          // oc login successful, kube config configured
          kc.loadFromDefault();
          vscode.window.showInformationMessage("KubeConfig context has been configured.");
        }
      });
    } else {
      // validate kube config by trying to make Api Clients
      try {
        this.openshiftServerURL = kc.getCurrentCluster()?.server;
        this.coreV1Api = kc.makeApiClient(k8s.CoreV1Api);
        this.customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to validate KubeConfig file. ${error}`);
        vscode.window.showInformationMessage("Please log into the OpenShift cluster again.");
      }
    }
  }

  /**
   * Executes the requested command
   * @param ocCmd - The oc command to be executed
   * @returns - A Promise containing a boolean signaling the success of the executed command
   */
  private async attemptOCLogin(ocCmd: OcCommand): Promise<Boolean> {
    return new Promise(async (resolve, reject) => {
      const args = await this.requestLogInInfo();
      if (args) {
        try {
          const response = await ocCmd.runOcLoginCommand(args);
          vscode.window.showInformationMessage(response);
          vscode.window.showInformationMessage("Successfully logged in to OpenShift cluster.");
          vscode.commands.executeCommand(VSCodeCommands.refreshAll);
          resolve(true);
        } catch (error) {
          vscode.window.showErrorMessage(`Failure logging in to OpenShift cluster: ${error}`);
          reject(false);
        }
      } else {
        reject(false);
      }
    });
  }

  /**
   * *** Copied from utilities to avioid circular dependency ***
   * Prompts the user for the necessary info to log in to an OpenShift cluster
   * @returns - A Promise containing the list of parameters to pass to the command
   */
  private async requestLogInInfo(): Promise<string[] | undefined> {
    let args: Array<string> = [];

    const inputArgs = await vscode.window.showInputBox({
      prompt: `Enter your oc login command: oc login --server=SERVER_URL --token=AUTH_TOKEN`,
      ignoreFocusOut: true,
      validateInput: text => {
        const ocLoginArgs = text.trimStart();

        // validate arguments
        const validRegex: { [key: string]: RegExp } = {
          "OC Command": /^(oc login)/,
          "Auth Token": /(--token=sha256~[A-Za-z0-9]+)/,
          "Server URL": /(--server=[A-Za-z0-9-\\\/\._~:\?\#\[\]@!\$&'\(\)\*\+,:;%=]+)/,
        };

        for (const rx in validRegex) {
          const failedRegex = !validRegex[rx].test(ocLoginArgs);
          if (failedRegex) {
            return "Format: oc login --server=SERVER_URL --token=AUTH_TOKEN (optionally --insecure-skip-tls-verify)";
          }
        }

        return null;
      },
    });

    if (inputArgs) {
      args = inputArgs
        .trimStart()
        .split(" ")
        ?.filter(item => {
          return item.length;
        })
        ?.slice(2);

      return args;
    } else {
      return undefined;
    }
  }
}
