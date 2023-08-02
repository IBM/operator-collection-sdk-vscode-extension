import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

import { runTests } from '@vscode/test-electron';

async function go() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './suite/index');
		const fixturePath = path.resolve(__dirname, '../../testFixures/zos_ims_operator');
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-user'));
		fs.copySync(
			path.resolve(__dirname, '../../testFixures/vscode-user/User'),
			path.join(tmpDir, 'User')
		);

		// Download VS Code, unzip it and run the integration test
		if (process.platform === 'win32') {
			await runTests({
				version: '1.80.0',
				platform: 'win32-x64-archive',
				extensionDevelopmentPath, 
				extensionTestsPath,
				launchArgs: [
					fixturePath,
					`--user-data-dir=${tmpDir}`
				],
			});
		} else {
			await runTests({ 
				extensionDevelopmentPath, 
				extensionTestsPath,
				launchArgs: [
					fixturePath,
					`--user-data-dir=${tmpDir}`
				],
			});
		}	
	} catch (err) {
		console.error('Failed to run tests', err);
		process.exit(1);
	}
}

go();
