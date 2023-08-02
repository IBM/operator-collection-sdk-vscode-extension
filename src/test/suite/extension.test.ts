import * as assert from 'assert';
import * as vscode from 'vscode';
import * as myExtension from '../../extension';
import * as child_process from 'child_process';
import {VSCodeCommands} from '../../utilities/commandConstants';

describe('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	before(async () => {
		const extension = vscode.extensions.getExtension("ibm.operator-collection-sdk");
  		await extension?.activate();
	});

	it('Should install the Operator Collection SDK', async () => {
		await vscode.commands.executeCommand(VSCodeCommands.install);
		try {
			child_process.execSync("ansible-galaxy collection verify ibm.operator_collection_sdk");
		} catch (e) {
			assert.equal(e, undefined);
		}
	});

	it('Create Operator', async () => {
		try {
			await vscode.commands.executeCommand(VSCodeCommands.createOperator);
		} catch (e) {
			assert.equal(e, undefined);
		}
	});
	
});
