/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from "path";
import * as fs from "fs";
import * as yaml from "js-yaml";
import * as vscode from "vscode";

/**
 * Retrieves the current workspace root directory if it exists
 * @returns — The vscode.WorkspaceFolder interface, or undefined if a directory doesn't exists
 */
export function getCurrentWorkspaceRootFolder(): string | undefined {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders?.length > 0) {
    return vscode.workspace.workspaceFolders[0].uri.path;
  }
  return undefined;
}

/**
 * Retrieves  All playbooks within the directory
 * @param directory - A directory to derive playbooks from
 * @returns — All playbooks within the directory
 */
export async function gatherDirectoryPlaybooks(directory: string): Promise<string[]> {
  const [files, _] = getDirectoryContent(directory, true, [".yaml", ".yml"]);

  const filteredFiles = [];
  for (let i = 0; i < files.length; i++) {
    try {
      // if the file contains the key "hosts", it is a playbook
      const content = getValuesFromYamlFile(files[i], [""])[0];
      if (content?.[0]?.hosts !== undefined) {
        // playbooks must use hosts: all i.e. content?.[0]?.hosts === "all"
        // but check is ommitted to accommodate user input error
        filteredFiles.push(files[i]);
      }
    } catch (e) {
      console.log(`Can't open file ${files[i]}: ${e}`);
    }
  }

  return pruneDirectoryStem(directory, filteredFiles);
}

/**
 * Retrieves the values for keys specified in the given filepath
 * @param filePath - A String representing path the the YAML file.
 * @param keys - An array of Strings whose values are requested. Supply keys = [""] to return all data.
 * @returns — A list of values where each element corresponds to a key in the paramter keys
 */
export function getValuesFromYamlFile(filePath: string, keys: string[]): Array<any> {
  if (!/.ya?ml$/.test(filePath)) {
    return [];
  }

  const values = [];
  const content = fs.readFileSync(filePath, "utf8");
  const data: any = yaml.load(content);
  if (keys.length === 1 && keys[0] === "") {
    values.push(data);
  } else {
    for (let i = 0; i < keys.length; i++) {
      values.push(data?.[keys[i]]);
    }
  }

  return values;
}

/**
 * Returns all children within a specified directory.
 * @param directory - A String representing the directory to derive content from.
 * @param recurse - A optional Boolean specifiying whether to get return the content of all decendants via recursion.
 * @param fileExtensions - An optional String Array containing the desired return file types (i.e. [".yaml", ".yml"]).
 * @returns An array object of files and directories (i.e. const [files, subdirectories] = getDirectoryContent(...)).
 */
export function getDirectoryContent(directory: string, recurse: boolean = false, fileExtensions: string[] = []): [string[], string[]] {
  const directoryContent = fs.readdirSync(directory, {
    withFileTypes: true,
    recursive: true,
  });

  const files: string[] = [];
  const directories: string[] = [];
  for (let i = 0; i < directoryContent.length; i++) {
    const item = path.join(directory, directoryContent[i].name);
    if (fs.lstatSync(item).isDirectory()) {
      directories.push(item);
    } else {
      if (fileExtensions.length) {
        if (fileExtensions.some(extension => item.includes(extension))) {
          files.push(item);
        }
      } else {
        files.push(item);
      }
    }
  }

  if (recurse && directories.length) {
    const subdirectoryContent = directories.map(subdirectory => {
      return getDirectoryContent(subdirectory, recurse, fileExtensions);
    });

    for (let i = 0; i < subdirectoryContent.length; i++) {
      const [f, d] = subdirectoryContent[i];
      files.push.apply(files, f); // extend array
      directories.push.apply(directories, d); // extend array
    }
  }

  return [files, directories];
}

/**
 * Returns paths to the decendants of directory that match a given target or empty if no matches are found.
 * @param directory - A String representing the directory to check for target from.
 * @param targets - A Regular Expression Array containing either target files or target folders but not both.
 * @param checkRecursively - A optional Boolean specifiying whether to check for target in all decendants.
 * @param fileExtensions - An optional String Array containing the type of target file (i.e. [".yaml", ".yml"]). Can help prune the search.
 * @returns An empty String Array if no matches are found or an Array containing the paths of matched files.
 */
export function getMatchingDecendants(directory: string, targets: RegExp[], checkRecursively: boolean = false, fileExtensions: string[] = []): string[] {
  const [files, directories] = getDirectoryContent(directory, checkRecursively, fileExtensions);
  const filesMatching = files.filter(file => targets.some(target => target.test(file)));
  if (filesMatching.length) {
    return filesMatching;
  }
  if (fileExtensions.length === 0) {
    const dirsMatching = directories.filter(dir => targets.some(target => target.test(dir)));
    if (dirsMatching.length) {
      return dirsMatching;
    }
  }
  return [];
}

/**
 * Executes omni-directional Breadth First Search on file system starting parameter queue[0].
 * @param queue - Mutable String Array initalized with the directory to begin searching from (i.e. const queue = [directoryPath]).
 * @param workspaceRootFolderName - The root vscode workspace folder. Serves as a limit past which recursion will stop.
 * @param target - Either a Sting containing the target file or directory name or a Regular Expression to test candidates against.
 * @param visited - Created and used internally (not to be passsed during function call).
 * @returns A String representing the pathway to the nearest target or empty string.
 */
export function findNearestFolderOrFile(queue: string[], workspaceRootFolderName: string, target: string | RegExp, visited: string[] = []): string | undefined {
  if (queue.length === 0) {
    return "";
  }

  const [files, directories] = getDirectoryContent(queue[0]);
  visited.push(queue[0]);

  // if we find the target in this directory, return target
  const targetRegex = typeof target === "string" ? new RegExp(`${target}\$`, "gm") : target;
  const filesMatching = files.filter(file => targetRegex.test(file));
  if (filesMatching.length) {
    return filesMatching[0];
  }
  const dirsMatching = directories.filter(dir => targetRegex.test(dir));
  if (dirsMatching.length) {
    return dirsMatching[0];
  }

  // otherwise keep searching recursively
  for (let i = 0; i < directories.length; i++) {
    if (!visited.includes(directories[i])) {
      queue.push(directories[i]);
    }
  }
  const parentDirectory = queue[0].substring(0, queue[0].lastIndexOf("/"));
  if (parentDirectory.includes(workspaceRootFolderName) && !visited.includes(parentDirectory)) {
    queue.push(parentDirectory);
  }

  return findNearestFolderOrFile(queue.slice(1), workspaceRootFolderName, target, visited);
}

/**
 * Removes a common stem from all supplied pathways.
 * @param stem - A String.
 * @param paths - A String Array containing pathways.
 * @returns A String Array containing pruned pathways.
 */
export function pruneDirectoryStem(stem: string, paths: string[]) {
  const re = new RegExp(`^${stem}/`, "gm");
  return paths.map(pathway => pathway.replace(re, ""));
}

/**
 * Checks if a candidate path is an ancestor or decendant of a primary path.
 * @param primary - A String path.
 * @param candidate - A String path.
 * @returns A boolean signaling whether the candidate path is in the direct path "bloodline".
 */
export function pathIsAncestorOrDecendant(primary: string, candidate: string) {
  return candidate.includes(primary) || primary.includes(candidate);
}

/**
 * Returns a valid collection path of the collection nearest to the supplied directory and a boolean specifying
 * whether that path is considered valid. A path in the "lineage" means its path is an ancestor or decendant of
 * the supplied directory. If the path is not valid the String is empty.
 * @param directory - A candidate directory to evaluate.
 * @param workspaceRootFolderName - The root vscode workspace folder. Will be derived if not supplied.
 * @returns A String path to the nearest collection within the path's lineage or an empty String if it could not
 * be determined.
 * @returns A Boolean specifying that the nearest collection could not be determined if true.
 */
export function findNearestCollectionInLineage(directory: string, workspaceRootFolderName?: string): [string, boolean] {
  let rootFolder: string | undefined = "";
  if (workspaceRootFolderName) {
    rootFolder = workspaceRootFolderName;
  } else {
    const workspaceFolder = getCurrentWorkspaceRootFolder();
    rootFolder = workspaceFolder ? path.basename(workspaceFolder) : workspaceFolder;
  }

  let collectionPath = "";
  let collectionPathIsAmbiguous = false;

  // Regex makes it simpler to check for .yaml vs .yml files
  const operatorConfigRX = /operator-config.ya?ml$/;
  const galaxyRX = /galaxy.ya?ml$/;

  // check if there are any operator-config/galaxy files in this directory or any of
  // its subdirectories, if there are, the collectionDirectory location is ambiguous
  const collectionFiles = getMatchingDecendants(directory, [operatorConfigRX, galaxyRX], true, [".yaml", ".yml"]);
  const operatorConfigFiles = collectionFiles.filter(file => operatorConfigRX.test(file));
  const galaxyFiles = collectionFiles.filter(file => galaxyRX.test(file));

  if (operatorConfigFiles.length > 1 || galaxyFiles.length > 1) {
    collectionPathIsAmbiguous = true;
    return ["", collectionPathIsAmbiguous];
  } else if (galaxyFiles.length === 1) {
    // if there exists a galaxy file in a folder that is a decendant of the
    // selected directory, then the new file should go in that collection
    collectionPath = path.dirname(galaxyFiles[0]);
  } else {
    if (rootFolder) {
      const nearestGalaxyFile = findNearestFolderOrFile([directory], rootFolder, galaxyRX);

      // if there is a galaxy file nearby and its path is an ancector of
      // the current selected directory, then the the new file should go in that collection
      // because we should not allow the user to create nested collections
      if (nearestGalaxyFile && path.dirname(directory).includes(path.dirname(nearestGalaxyFile))) {
        collectionPath = path.dirname(nearestGalaxyFile);
      }
    }
  }

  if (collectionPath === "") {
    if (operatorConfigFiles.length === 1) {
      // if there is a operator-config file in a folder that is a decendant
      // of the selected directory, then the new file should go there instead
      collectionPath = path.dirname(operatorConfigFiles[0]);
    } else {
      if (rootFolder) {
        const nearestOperatorConfigFile = findNearestFolderOrFile([directory], rootFolder, operatorConfigRX);

        // if there is a operator-config file nearby and its path is an ancector of
        // the current selected directory, then the new file should go in that collection
        // because we should not allow the user to create nested collections
        if (nearestOperatorConfigFile && path.dirname(directory).includes(path.dirname(nearestOperatorConfigFile))) {
          collectionPath = path.dirname(nearestOperatorConfigFile);
        }
      }
    }
  }

  return [collectionPath, collectionPathIsAmbiguous];
}

/**
 * Searches parent directories recursively for target and returns first match found.
 * @param directory - A String path to begin search parents from. Not a parent directory.
 * @param workspaceRootFolderName - A String path containing the workspace Root Folder Name.
 * @param targets - A Regular Expression Array containing either target files or target folders but not both.
 * @param fileExtensions - An optional String Array containing the type of target file (i.e. [".yaml", ".yml"]). May help prune the search.
 * @returns A String containing the path to the first target found or an empty string if no target was found.
 */
export function searchParents(directory: string, workspaceRootFolderName: string, targets: RegExp[], fileExtensions: string[] = []): string {
  const parentDirectory = directory.substring(0, directory.lastIndexOf("/"));
  if (!parentDirectory.includes(workspaceRootFolderName)) {
    return ""; // targets not found
  }

  // check decendants of parent directory for targets (non-recursively)
  const matchingFiles = getMatchingDecendants(parentDirectory, targets, false, fileExtensions);
  if (matchingFiles.length) {
    return matchingFiles[0];
  }

  // keep searching parents
  return searchParents(parentDirectory, workspaceRootFolderName, targets, fileExtensions);
}
