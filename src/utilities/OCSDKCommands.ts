import * as child_process from 'child_process';

export class OcSdkCommand {
    public static async run(cmd: string, pwd: string | undefined, args?: Array<string> | undefined): Promise<string> {
        const options = {
            cwd: pwd,
            env: process.env
        };
        
        let childProcess: child_process.ChildProcess;
        if (args === undefined) {
            childProcess = child_process.spawn(cmd, options);
        } else {
            childProcess = child_process.spawn(cmd, args, options);
        }

        let output: string = "";
        childProcess.stdout?.on('data', data => {
            output = data;
            console.log(`command output:\n${data}`);
        });
        childProcess.stderr?.on('data', data => {
            output = data;
            console.error(`command error:\n${data}`);
        });

        return new Promise<string>((resolve: any, reject: any) =>{
            childProcess.on('error', (error: Error) => {
                console.error(error.message);
                return reject(error.message);
            });
            childProcess.on('close', (code: number) => {
                if (code) {
                    if (code !== 0) {
                        return reject(output);
                    }
                } else {
                    return resolve(output);
                }
            });
        });
    }

    public static async runCreateOperatorCommand(args: Array<string>, pwd: string): Promise<string> {
        // let cmdArgs: string = `-e "`;
        // for (var i = 0; i < args.length; i++) {
        //     cmdArgs = cmdArgs.concat(`${args[i]} `);
        // }
        process.env.ANSIBLE_JINJA2_NATIVE = "true";
        const cmd: string = "ansible-playbook";
        args = args.concat("ibm.operator_collection_sdk.create_operator");
        return this.run(cmd, pwd, args);
    }

    public static async runRedeployCollectionCommand(pwd: string): Promise<string> {
        const cmd: string = "ansible-playbook";
        let args: Array<string> = ["ibm.operator_collection_sdk.redeploy_collection"];
        return this.run(cmd, pwd, args);
    }
}