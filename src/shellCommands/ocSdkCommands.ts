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
     private async run(cmd: string, args?: Array<string>, silenceOutput?: boolean): Promise<any> {
        process.env.PWD = this.pwd;
        const options: child_process.SpawnOptions = {
            cwd: this.pwd,
            env: process.env,
            shell: true,
            stdio: 'inherit'
        };
        
        let childProcess: child_process.ChildProcess;
        if (args) {
            childProcess = child_process.spawn(cmd, args, options);
        } else {
            childProcess = child_process.spawn(cmd, options);
        }
        

        if (!silenceOutput) {
            childProcess.stdout?.on('data', data => {
                console.log(`${data}`);
            });
        }

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
     * Executes the collection verify command to validate the collection is installed
     * @param silenceOutput - Set true to silence STDOUT output
     * @returns - A Promise container the return code of the command being executed
     */
     async runCollectionVerifyCommand(silenceOutput?: boolean): Promise<string> {
        const cmd: string = "ansible-galaxy";
        let args: Array<string> = [
            "collection",
            "verify",
            "ibm.operator_collection_sdk"
        ];
        return this.run(cmd, args, silenceOutput);
    }

    /**
     * Executes the collection install command to install the Operator Collection SDK
     * @param silenceOutput - Set true to silence STDOUT output
     * @returns - A Promise container the return code of the command being executed
     */
    async installOcSDKCommand(silenceOutput?: boolean): Promise<string> {
        // ansible-galaxy collection install ibm.operator_collection_sdk
        const cmd: string = "ansible-galaxy";
        let args: Array<string> = [
            "collection",
            "install",
            "ibm.operator_collection_sdk"
        ];
        return this.run(cmd, args, silenceOutput);
    }

    /**
     * Executes the Operator Collection SDK Create Operator command
     * @param args - The arguments to pass to the command
     * @param pwd - The current working directory
     * @param silenceOutput - Set true to silence STDOUT output
     * @returns - A Promise container the return code of the command being executed
     */
    async runCreateOperatorCommand(args: Array<string>, silenceOutput?: boolean): Promise<any> {
        process.env.ANSIBLE_JINJA2_NATIVE = "true";
        const cmd: string = "ansible-playbook";
        args = args.concat("ibm.operator_collection_sdk.create_operator");
        return this.run(cmd, args, silenceOutput);
    }

     /**
     * Executes the Operator Collection SDK Delete Operator command
     * @param silenceOutput - Set true to silence STDOUT output
     * @returns - A Promise container the return code of the command being executed
     */
    async runDeleteOperatorCommand(silenceOutput?: boolean): Promise<string> {
        return this.executeSimpleCommand("ibm.operator_collection_sdk.delete_operator", silenceOutput);
    }

    /**
     * Executes the Operator Collection SDK Redeploy Collection command
     * @param silenceOutput - Set true to silence STDOUT output
     * @returns - A Promise container the return code of the command being executed
     */
    async runRedeployCollectionCommand(silenceOutput?: boolean): Promise<string> {
        return this.executeSimpleCommand("ibm.operator_collection_sdk.redeploy_collection", silenceOutput);
    }

     /**
     * Executes the Operator Collection SDK Redeploy Operator command
     * @param silenceOutput - Set true to silence STDOUT output
     * @returns - A Promise container the return code of the command being executed
     */
    async runRedeployOperatorCommand(silenceOutput?: boolean): Promise<string> {
        return this.executeSimpleCommand("ibm.operator_collection_sdk.redeploy_operator", silenceOutput);
    }

    /**
     * Executes an Operator Collection SDK command without additional arguments
     * @param command - The command to execute
     * @param silenceOutput - Set true to silence STDOUT output
     * @returns - A Promise container the return code of the command being executed
     */
    private executeSimpleCommand(command: string, silenceOutput?: boolean): Promise<any> {
        const cmd: string = "ansible-playbook";
        let args: Array<string> = [command];
        return this.run(cmd, args, silenceOutput);
    }
}