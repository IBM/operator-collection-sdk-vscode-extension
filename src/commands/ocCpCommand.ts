import * as child_process from 'child_process';

export class OcCpCommand {
    /**
     * Executes the requested command
     * @param cmd - The command to be executed
     * @param pwd - The currrent working directory
     * @param args - The arguments to pass to the command
     * @returns - A Promise containing the the return code of the executed command
     */
     private async run(args?: Array<string> | undefined): Promise<any> {
        const options = {
            env: process.env,
            shell: true
        };
        
        let childProcess: child_process.ChildProcess;
        childProcess = child_process.spawn("oc", args, options);

        childProcess.stdout?.on('data', data => {
            console.log(`${data}`);
        });
        childProcess.stderr?.on('data', data => {
            console.error(`${data}`);
        });

        return new Promise<string>((resolve: any, reject: any) => {
            childProcess.on('error', (error: Error) => {
                console.error(error.message);
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
     async runOcCpCommand(podName: string, namespace: string,containerName: string, workspacePath: string, apiVersion: string, kind: string, instanceName: string): Promise<any> {
        const args: Array<string> = [
            "cp",
            `${namespace}/${podName}:/tmp/ansible-operator/runner/suboperator.zoscb.ibm.com/${apiVersion}/${kind}/${namespace}/${instanceName}/artifacts/latest/stdout`,
            workspacePath,
            "-c",
            containerName
        ];
        return this.run(args);
    }
}