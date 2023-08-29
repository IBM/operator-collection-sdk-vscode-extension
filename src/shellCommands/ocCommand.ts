/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as fs from 'fs-extra';

export class OcCommand {
    /**
     * Executes the requested command
     * @param args - The arguments to pass to the command
     * @param outputChannel - The VS Code output channel to display command output
     * @param logPath - Log path to store command output
     * @returns - A Promise containing the the return code of the executed command
     */
     private async run(args?: Array<string>, outputChannel?: vscode.OutputChannel, logPath?: string): Promise<any> {
        const options: | child_process.SpawnOptions = {
            env: process.env,
            shell: true,
            stdio: 'pipe'
        };
        
        let childProcess: child_process.ChildProcess;
        if (args){
            childProcess = child_process.spawn("oc", args, options);
        } else {
            childProcess = child_process.spawn("oc", options);
        }

        if (logPath) {
            let logStream = fs.createWriteStream(logPath, {flags: 'a'});
            childProcess.stdout?.pipe(logStream);
            childProcess.stderr?.pipe(logStream);
        }

        let output: string="";
        childProcess.stdout?.on('data', data => {
            outputChannel?.appendLine(data);
            output = output.concat(data);
        });
        childProcess.stderr?.on('data', data => {
            outputChannel?.appendLine(data);
            output = output.concat(data);
        });

        return new Promise<string>((resolve: any, reject: any) => {
            childProcess.on('error', (error: Error) => {
                outputChannel?.appendLine(error.message);
                return reject(error.message);
            });
            childProcess.on('close', (code: number) => {
                if (code) {
                    if (code === 0) {
                        return resolve(output);
                    } else {
                        return reject(output);
                    }
                } else {
                    return resolve(output);
                }
            });
        });
    }

    /**
     * Executes the oc cp command
     * @param podName
     * @param namespace 
     * @param containerName 
     * @param apiVersion 
     * @param kind 
     * @param instanceName 
     * @returns 
     */
     async runOcExecCommand(podName: string, namespace: string,containerName: string, apiVersion: string, kind: string, instanceName: string, outputChannel?: vscode.OutputChannel, logPath?: string): Promise<any> {
        const args: Array<string> = [
            "exec",
            podName,
            "-c",
            containerName,
            "--",
            "cat",
            `/tmp/ansible-operator/runner/suboperator.zoscb.ibm.com/${apiVersion}/${kind}/${namespace}/${instanceName}/artifacts/latest/stdout`
        ];
        return this.run(args, outputChannel, logPath);
    }

    /**
     * Executes the oc cp command
     * @param podName
     * @param namespace 
     * @param containerName 
     * @param workspacePath 
     * @param apiVersion 
     * @param kind 
     * @param instanceName 
     * @returns 
     */
    async runOcCpCommand(podName: string, namespace: string,containerName: string, workspacePath: string, apiVersion: string, kind: string, instanceName: string, outputChannel?: vscode.OutputChannel, logPath?: string): Promise<any> {
        const args: Array<string> = [
            "cp",
            `${namespace}/${podName}:/tmp/ansible-operator/runner/suboperator.zoscb.ibm.com/${apiVersion}/${kind}/${namespace}/${instanceName}/artifacts/latest/stdout`,
            workspacePath,
            "-c",
            containerName
        ];
        return this.run(args, outputChannel, logPath);
    }

    /**
     * Executes the oc login command
     * @param serverURL 
     * @param token 
     * @returns 
     */
    async runOcLoginCommand(args: Array<string>, outputChannel?: vscode.OutputChannel, logPath?: string): Promise<any> {
        const logInArg: Array<string> = ["login"];
        const finalArgs = logInArg.concat(args);
        return this.run(finalArgs, outputChannel, logPath);
    }

    /**
     * Executes the oc login command
     * @param serverURL 
     * @param token 
     * @returns 
     */
    async runOcProjectCommand(project: string, outputChannel?: vscode.OutputChannel, logPath?: string): Promise<any> {
        const args: Array<string> = ["project", project];
        return this.run(args, outputChannel, logPath);
    }
}