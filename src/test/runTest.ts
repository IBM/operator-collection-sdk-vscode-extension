import * as path from 'path';
import * as fs from 'fs-extra';
import * as helper from './helper';

import { runTests } from '@vscode/test-electron';

async function go() {
	const extensionDevelopmentPath = path.resolve(__dirname, '../../');
	const extensionTestsPath = path.resolve(__dirname, './suite/index');
	try {
		fs.copySync(
			path.resolve(__dirname, '../../testFixures/vscode-user/User'),
			path.join(helper.tmpDir, 'User')
		);
		
		if (!fs.existsSync(`${helper.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`)) {
			fs.copySync(helper.extraVarsFile, `${helper.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
		} else {
			fs.unlinkSync(`${helper.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
			fs.copySync(helper.extraVarsFile, `${helper.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
		}

		if (!fs.existsSync(`${helper.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`)) {
			fs.copySync(helper.extraVarsFile, `${helper.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
		} else {
			fs.unlinkSync(`${helper.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
			fs.copySync(helper.extraVarsFile, `${helper.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
		}

		// Download VS Code, unzip it and run the integration test
		if (process.platform === 'win32') {
			await runTests({
				version: '1.80.0',
				platform: 'win32-x64-archive',
				extensionDevelopmentPath, 
				extensionTestsPath,
				launchArgs: [
					helper.ocWorkspacePath,
					`--user-data-dir=${helper.tmpDir}`
				],
			});
		} else {
			await runTests({ 
				extensionDevelopmentPath, 
				extensionTestsPath,
				launchArgs: [
					helper.ocWorkspacePath,
					`--user-data-dir=${helper.tmpDir}`
				],
			});
		}	
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

go();
