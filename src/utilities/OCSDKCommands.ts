import * as child_process from 'child_process';

export class OcSdkCommand {
    /**
     * Executes the requested command
     * @param cmd - The command to be executed
     * @param pwd - The currrent working directory
     * @param args - The arguments to pass to the command
     * @returns - A Promise containing the the return code of the executed command
     */
    private static async run(cmd: string, pwd: string | undefined, args?: Array<string> | undefined): Promise<any> {
        const options = {
            cwd: pwd,
            env: process.env,
            shell: true
        };
        
        let childProcess: child_process.ChildProcess;
        if (args === undefined) {
            childProcess = child_process.spawn(cmd, options);
        } else {
            childProcess = child_process.spawn(cmd, args, options);
        }

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
     * Executes the Operator Collection SDK Create Operator command
     * @param args - The arguments to pass to the command
     * @param pwd - The current working directory
     * @returns - A Promise container the return code of the command being executed
     */
    public static async runCreateOperatorCommand(args: Array<string>, pwd: string): Promise<any> {
        process.env.ANSIBLE_JINJA2_NATIVE = "true";
        process.env.PWD = pwd;
        const cmd: string = "ansible-playbook";
        args.push(`-e "filepath=${pwd}"`);
        args = args.concat("ibm.operator_collection_sdk.create_operator");
        return this.run(cmd, pwd, args);
    }

     /**
     * Executes the Operator Collection SDK Delete Operator command
     * @param pwd - The current working directory
     * @returns - A Promise container the return code of the command being executed
     */
    public static async runDeleteOperatorCommand(pwd: string): Promise<string> {
        return this.executeSimpleCommand(pwd, "ibm.operator_collection_sdk.delete_operator");
    }

    /**
     * Executes the Operator Collection SDK Redeploy Collection command
     * @param pwd - The current working directory
     * @returns - A Promise container the return code of the command being executed
     */
    public static async runRedeployCollectionCommand(pwd: string): Promise<string> {
        return this.executeSimpleCommand(pwd, "ibm.operator_collection_sdk.redeploy_collection");
    }

     /**
     * Executes the Operator Collection SDK Redeploy Operator command
     * @param pwd - The current working directory
     * @returns - A Promise container the return code of the command being executed
     */
    public static async runRedeployOperatorCommand(pwd: string): Promise<string> {
        return this.executeSimpleCommand(pwd, "ibm.operator_collection_sdk.redeploy_operator");
    }

    /**
     * Executes an Operator Collection SDK command without additional arguments
     * @param pwd - The current working directory
     * @param command - The command to execute
     * @returns - A Promise container the return code of the command being executed
     */
    private static executeSimpleCommand(pwd: string, command: string): Promise<any> {
        process.env.PWD = pwd;
        const cmd: string = "ansible-playbook";
        let args: Array<string> = [command];
        return this.run(cmd, pwd, args);
    }
}