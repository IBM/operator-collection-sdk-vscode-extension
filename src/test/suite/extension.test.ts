import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as myExtension from '../../extension';
import * as child_process from 'child_process';
import {VSCodeCommands} from '../../utilities/commandConstants';
import * as helper from '../helper';
import {OperatorItem} from "../../treeViews/operatorItems/operatorItem";


describe('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');
	const imsOperatorItem: OperatorItem | undefined = new OperatorItem("IBM Z and Cloud Modernization Stack - IMS Operator", "zos-ims-operator", helper.imsOperatorCollectionPath);
	let k8s: helper.KubernetesObj;
	let cleanup: boolean = false;
	let userLoggedIn: boolean = false;
	
	before(async () => {
		const extension = vscode.extensions.getExtension("ibm.operator-collection-sdk");
  		await extension?.activate();
		k8s = new helper.KubernetesObj();

		userLoggedIn = await k8s.isUserLoggedIntoOCP();
		if (!userLoggedIn) {
			const testClusterInfo = helper.getTestClusterInfo();
			if (testClusterInfo instanceof Error) {
				assert.fail(testClusterInfo);
			}

			// Login to Openshift
			let args: Array<string> = [`--server="${testClusterInfo.ocpServerUrl}"`, `--token="${testClusterInfo.ocpToken}"`];
			try {
				vscode.commands.executeCommand(VSCodeCommands.login, args);
				await helper.sleep(5000);
			} catch (e) {
				assert.fail("Failure logging in to OCP cluster");
			}

			// Update K8s object to retrieve config after log in
			k8s = new helper.KubernetesObj();
			userLoggedIn = await k8s.isUserLoggedIntoOCP();
			assert.equal(userLoggedIn, true);

			if (! await k8s.validateNamespaceExists(testClusterInfo.ocpNamespace)) {
				// Create Namespace
				let namespaceObject: helper.ObjectInstance;
				try {
					namespaceObject = await k8s.createNamespace(testClusterInfo.ocpNamespace);
				} catch(e) {
					assert.fail(`Failure creating Namespace: ${e}`);
				}

				// Cleanup namespace and auto-installed broker instances after completion
				cleanup = true;
				try {
					vscode.commands.executeCommand(VSCodeCommands.updateProject, testClusterInfo.ocpNamespace);
					await helper.sleep(5000);
				} catch (e) {
					assert.fail("Failure logging in to OCP cluster");
				}
				k8s = new helper.KubernetesObj(testClusterInfo.ocpNamespace);

				// Install ZosCloudBroker
				try {
					await k8s.installZosCloudBroker();
				} catch (e) {
					assert.fail(`Failure installing ZosCloudBroker: ${e}`);
				}
			}
		}

		
		try {
			vscode.commands.executeCommand(VSCodeCommands.deleteOperator, imsOperatorItem);
			await helper.pollOperatorDeleteStatus(imsOperatorItem.operatorName, 10);
		} catch (e) {
			assert.fail(`Failure executing deleteOperator command: ${e}`);
		}
	});

	after(async () => {
		if (userLoggedIn) {
			try {
				vscode.commands.executeCommand(VSCodeCommands.deleteOperator, imsOperatorItem);
				await helper.pollOperatorDeleteStatus(imsOperatorItem.operatorName, 10);
				if (cleanup) {
					await k8s.cleanupNamespace();
				}
			} catch (e) {
				assert.fail(`Failure performing cleanup: ${e}`);
			}
		}
	});

	describe('Validate Commands', () => {
		const createOperatorLogPath = path.join(__dirname, "createOperator.log");
		const redeployCollectionLogPath = path.join(__dirname, "redeployCollection.log");
		const redeployOperatorLogPath = path.join(__dirname, "redeployOperator.log");
		it('Should install the Operator Collection SDK', async () => {
			// await vscode.commands.executeCommand(VSCodeCommands.install);
			const output = child_process.execSync("ansible-galaxy collection install ibm.operator_collection_sdk");
			console.log(output.toString());
			await helper.sleep(15000);
			try {
				child_process.execSync("ansible-galaxy collection verify ibm.operator_collection_sdk");
			} catch (e) {
				assert.equal(e, undefined);
			}
		});
		it('Create Operator', async () => {
			try {
				// child_process.execSync(`ansible-playbook  --extra-vars "@/Users/runner/work/operator-collection-sdk-vscode-extension/operator-collection-sdk-vscode-extension/testFixures/zos_ims_operator/ocsdk-extra-vars.yml" ibm.operator_collection_sdk.create_operator`);
				// console.log(output.toString());
				// await helper.sleep(60000);
				vscode.commands.executeCommand(VSCodeCommands.createOperator, imsOperatorItem, createOperatorLogPath);
				await helper.pollOperatorInstallStatus(imsOperatorItem.operatorName, 3);
			} catch (e) {
				let log = fs.readFileSync(createOperatorLogPath);
				console.log("Printing logs");
				console.log(log.toString());
				assert.fail("Failure executing createOperator command");
			}
		});
		// it('Redeploy Collection', async () => {
		// 	try {
		// 		const oldPod = await k8s.getOperatorPods(imsOperatorItem.operatorName);
		// 		if (oldPod === undefined || oldPod.length !== 1) {
		// 			assert.fail("Failure validating operator pods");
		// 		}
		// 		const oldPodName = oldPod[0].metadata?.name;
		// 		vscode.commands.executeCommand(VSCodeCommands.redeployCollection, imsOperatorItem);
		// 		await helper.pollOperatorPodStatus(imsOperatorItem.operatorName, oldPodName!, 30);
		// 	} catch (e) {
		// 		assert.fail("Failure executing redeployCollection command");
		// 	}
		// });
		// it('Redeploy Operator', async () => {
		// 	try {
		// 		vscode.commands.executeCommand(VSCodeCommands.redeployOperator, imsOperatorItem);
		// 		await helper.sleep(20000);
		// 		await helper.pollOperatorInstallStatus(imsOperatorItem.operatorName, 40);
		// 	} catch (e) {
		// 		assert.fail("Failure executing redeployOperator command");
		// 	}
		// });
	});
});
