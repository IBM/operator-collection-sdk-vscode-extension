import * as os from "os";
import * as path from "path";
import * as fs from "fs-extra";

export const fixturePath = path.resolve(__dirname, "../../testFixures/");
export const extraVarsFile = `${fixturePath}/ocsdk-extra-vars.yml`;
export const cicsOperatorCollectionPath = `${fixturePath}/zos_cics_operator`;
export const imsOperatorCollectionPath = `${fixturePath}/zos_ims_operator`;
export const customOperatorCollectionPath = `${fixturePath}/custom_operator`;
export const pseudoCollectionPath = `${fixturePath}/pseudo_operator`;
export const ocWorkspacePath = `${fixturePath}/operator-collections.code-workspace`;
export const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-user"));
