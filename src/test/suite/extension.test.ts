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
	const ocLoginLogPath = path.join(__dirname, "ocLogin.log");
	const installSdkLogPath = path.join(__dirname, "installOcSdk.log");
	const updateProjectLogPath = path.join(__dirname, "updateProject.log");
	const deleteOperatorBeforeAllLogPath = path.join(__dirname, "deleteOperatorBeforeAll.log");
	const deleteOperatorAfterAllLogPath = path.join(__dirname, "deleteOperatorAfterAll.log");
	const createOperatorLogPath = path.join(__dirname, "createOperator.log");
	const redeployCollectionLogPath = path.join(__dirname, "redeployCollection.log");
	const redeployOperatorLogPath = path.join(__dirname, "redeployOperator.log");
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
				vscode.commands.executeCommand(VSCodeCommands.login, args, ocLoginLogPath);
				await helper.sleep(5000);
			} catch (e) {
				console.log("Printing OC Login logs");
				helper.displayCmdOutput(ocLoginLogPath);
				assert.fail("Failure logging in to OCP cluster");
			}

			// Update K8s object to retrieve config after log in
			k8s = new helper.KubernetesObj();
			userLoggedIn = await k8s.isUserLoggedIntoOCP();
			assert.equal(userLoggedIn, true);

			// Create Namespace if not already created
			let namespaceObject: helper.ObjectInstance | undefined;
			try {
				namespaceObject = await k8s.createNamespace(testClusterInfo.ocpNamespace);
			} catch(e) {
				assert.fail(`Failure creating Namespace: ${e}`);
			}

			// If namespace was created via test, then we should cleanup this namespace and the auto-installed broker instance after completion
			if (namespaceObject) {
				cleanup = true;
			}
			try {
				vscode.commands.executeCommand(VSCodeCommands.updateProject, testClusterInfo.ocpNamespace, updateProjectLogPath);
				await helper.sleep(5000);
			} catch (e) {
				console.log("Printing Update Project command logs");
				helper.displayCmdOutput(updateProjectLogPath);
				assert.fail("Failure logging in to OCP cluster");
			}
			k8s = new helper.KubernetesObj(testClusterInfo.ocpNamespace);

			// Install ZosCloudBroker if not already installed
			try {
				await k8s.installZosCloudBroker();
			} catch (e) {
				assert.fail(`Failure installing ZosCloudBroker: ${e}`);
			}
		}

		try {
			vscode.commands.executeCommand(VSCodeCommands.deleteOperator, imsOperatorItem);
			await helper.pollOperatorDeleteStatus(imsOperatorItem.operatorName, 10);
		} catch (e) {
			console.log("Printing Delete Operator command logs");
			helper.displayCmdOutput(deleteOperatorBeforeAllLogPath);
			assert.fail(`Failure executing deleteOperator command: ${e}`);
		}
	});

	after(async () => {
		if (fs.existsSync(installSdkLogPath)) {
			fs.unlinkSync(installSdkLogPath);
		}
		if (fs.existsSync(ocLoginLogPath)) {
			fs.unlinkSync(ocLoginLogPath);
		}
		if (fs.existsSync(updateProjectLogPath)) {
			fs.unlinkSync(updateProjectLogPath);
		}
		if (fs.existsSync(createOperatorLogPath)) {
			fs.unlinkSync(createOperatorLogPath);
		}
		if (fs.existsSync(redeployCollectionLogPath)) {
			fs.unlinkSync(redeployCollectionLogPath);
		}
		if (fs.existsSync(redeployOperatorLogPath)) {
			fs.unlinkSync(redeployOperatorLogPath);
		}
		if (fs.existsSync(deleteOperatorBeforeAllLogPath)) {
			fs.unlinkSync(deleteOperatorBeforeAllLogPath);
		}
		if (fs.existsSync(deleteOperatorBeforeAllLogPath)) {
			fs.unlinkSync(deleteOperatorBeforeAllLogPath);
		}

		if (userLoggedIn) {
			try {
				vscode.commands.executeCommand(VSCodeCommands.deleteOperator, imsOperatorItem);
				await helper.pollOperatorDeleteStatus(imsOperatorItem.operatorName, 10);
				if (cleanup) {
					await k8s.cleanupNamespace();
				}
			} catch (e) {
				console.log("Printing Delete Operator command logs");
				helper.displayCmdOutput(deleteOperatorAfterAllLogPath);
				if (fs.existsSync(deleteOperatorAfterAllLogPath)) {
					fs.unlinkSync(deleteOperatorAfterAllLogPath);
				}
				assert.fail(`Failure performing cleanup: ${e}`);
			}
		}
	});

	describe('Validate Commands', () => {
		it('Should install the Operator Collection SDK', async () => {
			vscode.commands.executeCommand(VSCodeCommands.install, installSdkLogPath);
			await helper.sleep(15000);
			try {
				child_process.execSync("ansible-galaxy collection verify ibm.operator_collection_sdk");
			} catch (e) {
				console.log("Printing Install OC SDK logs");
				helper.displayCmdOutput(installSdkLogPath);
				assert.equal(e, undefined);
			}
		});
		it('Create Operator', async () => {
			try {
				vscode.commands.executeCommand(VSCodeCommands.createOperator, imsOperatorItem, createOperatorLogPath);
				await helper.pollOperatorInstallStatus(imsOperatorItem.operatorName, 40);
			} catch (e) {
				console.log("Printing Create Operator logs");
				helper.displayCmdOutput(createOperatorLogPath);
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
