/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import * as child_process from 'child_process';

export class OcSdkCommand {
    constructor(private pwd?: string | undefined) {}
    
    /**
     * Executes the requested command
     * @param cmd - The command to be executed
     * @param pwd - The currrent working directory
     * @param args - The arguments to pass to the command
     * @returns - A Promise containing the the return code of the executed command
     */
     private async run(cmd: string, args?: Array<string>, outputChannel?: vscode.OutputChannel): Promise<any> {
        console.log("Executing command");
        process.env.PWD = this.pwd;
        const options: child_process.SpawnOptions = {
            cwd: this.pwd,
            env: process.env,
            shell: true,
            stdio: 'pipe'
        };
        
        let childProcess: child_process.ChildProcess;
        if (args) {
            console.log("cmd: " + cmd);
            console.log("Args: " + args.toString());
            childProcess = child_process.spawn(cmd, args, options);
        } else {
            childProcess = child_process.spawn(cmd, options);
        }


        childProcess.stdout?.on('data', data => {
            outputChannel?.appendLine(data);
            console.log(data);
        });

        childProcess.stderr?.on('data', data => {
            outputChannel?.appendLine(data);
            console.log(data);
        });

        return new Promise<string>((resolve: any, reject: any) => {
            childProcess.on('error', (error: Error) => {
                outputChannel?.appendLine(error.message);
                return reject(error.message);
            });
            childProcess.on('close', (code: number) => {
                if (code) {
                    if (code !== 0) {
                        return reject(code);
                    }
                } else {
                    return resolve(code);
                }
            });
        });
    }

    /**
     * Executes the collection verify command to validate the collection is installed
     * @param outputChannel - The VS Code output channel to display command output
     * @returns - A Promise container the return code of the command being executed
     */
     async runCollectionVerifyCommand(outputChannel?: vscode.OutputChannel): Promise<string> {
        const cmd: string = "ansible-galaxy";
        let args: Array<string> = [
            "collection",
            "verify",
            "ibm.operator_collection_sdk"
        ];
        return this.run(cmd, args, outputChannel);
    }

    /**
     * Executes the collection install command to install the Operator Collection SDK
     * @param outputChannel - The VS Code output channel to display command output
     * @returns - A Promise container the return code of the command being executed
     */
    async installOcSDKCommand(outputChannel?: vscode.OutputChannel): Promise<string> {
        // ansible-galaxy collection install ibm.operator_collection_sdk
        const cmd: string = "ansible-galaxy";
        let args: Array<string> = [
            "collection",
            "install",
            "ibm.operator_collection_sdk"
        ];
        return this.run(cmd, args, outputChannel);
    }

    /**
     * Executes the Operator Collection SDK Create Operator command
     * @param args - The arguments to pass to the command
     * @param outputChannel - The VS Code output channel to display command output
     * @returns - A Promise container the return code of the command being executed
     */
    async runCreateOperatorCommand(args: Array<string>, outputChannel?: vscode.OutputChannel): Promise<any> {
        process.env.ANSIBLE_JINJA2_NATIVE = "true";
        const cmd: string = "ansible-playbook";
        args = args.concat("ibm.operator_collection_sdk.create_operator");
        return this.run(cmd, args, outputChannel);
    }

     /**
     * Executes the Operator Collection SDK Delete Operator command
     * @param outputChannel - The VS Code output channel to display command output
     * @returns - A Promise container the return code of the command being executed
     */
    async runDeleteOperatorCommand(outputChannel?: vscode.OutputChannel): Promise<string> {
        return this.executeSimpleCommand("ibm.operator_collection_sdk.delete_operator", outputChannel);
    }

    /**
     * Executes the Operator Collection SDK Redeploy Collection command
     * @param outputChannel - The VS Code output channel to display command output
     * @returns - A Promise container the return code of the command being executed
     */
    async runRedeployCollectionCommand(outputChannel?: vscode.OutputChannel): Promise<string> {
        return this.executeSimpleCommand("ibm.operator_collection_sdk.redeploy_collection", outputChannel);
    }

     /**
     * Executes the Operator Collection SDK Redeploy Operator command
     * @param outputChannel - The VS Code output channel to display command output
     * @returns - A Promise container the return code of the command being executed
     */
    async runRedeployOperatorCommand(outputChannel?: vscode.OutputChannel): Promise<string> {
        return this.executeSimpleCommand("ibm.operator_collection_sdk.redeploy_operator", outputChannel);
    }

    /**
     * Executes an Operator Collection SDK command without additional arguments
     * @param command - The command to execute
     * @param outputChannel - The VS Code output channel to display command output
     * @returns - A Promise container the return code of the command being executed
     */
    private executeSimpleCommand(command: string, outputChannel?: vscode.OutputChannel): Promise<any> {
        const cmd: string = "ansible-playbook";
        let args: Array<string> = [command];
        return this.run(cmd, args, outputChannel);
    }
}