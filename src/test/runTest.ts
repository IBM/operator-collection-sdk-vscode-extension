import * as path from "path";
import * as fs from "fs-extra";
import * as testVars from "./testVars";
import * as cp from "child_process";

import { runTests, downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from "@vscode/test-electron";

async function go() {
  const extensionDevelopmentPath = path.resolve(__dirname, "../../");
  const extensionTestsPath = path.resolve(__dirname, "./suite/index");

  // Download VS Code, unzip it
  let vscodeExecutablePath;
  if (process.platform === "win32") {
    vscodeExecutablePath = await downloadAndUnzipVSCode("1.80.0", "win32-x64-archive");
  } else {
    vscodeExecutablePath = await downloadAndUnzipVSCode("1.92.2");
  }
  const [cliPath, ...args] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

  try {
    fs.copySync(path.resolve(__dirname, "../../testFixures/vscode-user/User"), path.join(testVars.tmpDir, "User"));

    if (!fs.existsSync(`${testVars.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`)) {
      fs.copySync(testVars.extraVarsFile, `${testVars.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
    } else {
      fs.unlinkSync(`${testVars.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
      fs.copySync(testVars.extraVarsFile, `${testVars.imsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
    }

    if (!fs.existsSync(`${testVars.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`)) {
      fs.copySync(testVars.extraVarsFile, `${testVars.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
    } else {
      fs.unlinkSync(`${testVars.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
      fs.copySync(testVars.extraVarsFile, `${testVars.cicsOperatorCollectionPath}/ocsdk-extra-vars.yml`);
    }

    // Custom setup of extension dependencies
    cp.spawnSync(cliPath, [...args, "--install-extension", "redhat.vscode-yaml", "--install-extension", "iliazeus.vscode-ansi"], {
      encoding: "utf-8",
      stdio: "inherit",
    });

    //Run the integration test
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testVars.ocWorkspacePath, `--user-data-dir=${testVars.tmpDir}`],
    });
  } catch (err) {
    console.error("Failed to run tests", err);
    process.exit(1);
  }
}

go();
