/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";

/**
 * Retrieve the current workspace root directory if it exists
 * @returns — The vscode.WorkspaceFolder interface, or undefined if a directory doesn't exists
 */
export function getCurrentWorkspaceRootFolder(): string | undefined {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders?.length > 0) {
    return vscode.workspace.workspaceFolders[0].uri.path;
  }
  return undefined;
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
 * @param target - A Regular Expresion Array containing either the target file names or directory names as they are to be tested.
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
 * Checks if the candidate path is an ancestor path. All folders in the candidate
 * (ancestor) path must be present in the primary (decendant) path.
 * @param primary - A String path.
 * @param candidate - A String path.
 * @returns A boolean signaling whether the candidate path is an ancestor.
 */
export function pathsIsAncestor(primary: string, candidate: string) {
  return primary.includes(candidate);
}

/**
 * Checks if the candidate path is a decendant path. All folders in the primary
 * (ancestor) path must be present in the candidate (decendant) path.
 * @param primary - A String path.
 * @param candidate - A String path.
 * @returns A boolean signaling whether the candidate path is a decendant.
 */
export function pathsIsDecendant(primary: string, candidate: string) {
  return candidate.includes(primary);
}

/**
 * Checks if a candidate path is an ancestor or decendant of a primary path.
 * @param primary - A String path.
 * @param candidate - A String path.
 * @returns A boolean signaling whether the candidate path is in the direct path "bloodline".
 */
export function pathsIsAncestorOrDecendant(primary: string, candidate: string) {
  return pathsIsAncestor(primary, candidate) || pathsIsDecendant(primary, candidate);
}

/**
 * Evaluates whether the directory path passed is a valid directory for a collection and returns it,
 * the nearest collection path, or an empty string.
 * @param directory - A candidate directory to evaluate.
 * @param displayErrors - A Boolean that can be used to turn of vscode alerts if needed.
 * @returns A String path to the nearest collection within the path's ancestors or decendants or empty String
 * if it could not be determined.
 * @returns A Boolean, ambiguous, specifying that the nearest collection could not be determined if true.
 */
export function findNearestCollectionRoot(directory: string): [string, boolean] {
  const workspaceFolder = getCurrentWorkspaceRootFolder();
  const rootFolder = workspaceFolder ? path.basename(workspaceFolder) : workspaceFolder;

  let ambiguous = false;
  let collectionDirectory = "";
  const fileRX = {
    // Regex makes it simpler to check for .yaml vs .yml files
    operatorConfigRX: /operator-config.ya?ml$/,
    galaxyRX: /galaxy.ya?ml$/,
  };

  // check if there are any operator-config/galaxy files in this directory or any of
  // its subdirectories, if there are, the collectionDirectory location is ambiguous
  const collectionFiles = getMatchingDecendants(directory, [fileRX.operatorConfigRX, fileRX.galaxyRX], true, [".yaml", ".yml"]);
  const operatorConfigFiles = collectionFiles.filter(file => fileRX.operatorConfigRX.test(file));
  const galaxyFiles = collectionFiles.filter(file => fileRX.galaxyRX.test(file));

  if (operatorConfigFiles.length > 1 || galaxyFiles.length > 1) {
    return ["", true];
  } else if (galaxyFiles.length === 1) {
    // if there exists a galaxy file that is a decendant of the current
    // selected directory, then the new file should go in that collection
    collectionDirectory = path.dirname(galaxyFiles[0]);
  } else {
    if (rootFolder) {
      const nearestGalaxyFile = findNearestFolderOrFile([directory], rootFolder, fileRX.galaxyRX);

      // if there is a galaxy file nearby and its path is an ancector of
      // the current selected directory, then the the new file should go in that collection
      // because we should not allow the user to create nested collections
      if (nearestGalaxyFile && path.dirname(directory).includes(path.dirname(nearestGalaxyFile))) {
        collectionDirectory = path.dirname(nearestGalaxyFile);
      }
    }
  }

  if (collectionDirectory === "") {
    if (operatorConfigFiles.length === 1) {
      // if there is a operator-config file that is a decendant of the current
      // selected directory, then the new file should go there instead
      collectionDirectory = path.dirname(operatorConfigFiles[0]);
    } else {
      if (rootFolder) {
        const nearestOperatorConfigFile = findNearestFolderOrFile([directory], rootFolder, fileRX.operatorConfigRX);

        // if there is a operator-config file nearby and its path is an ancector of
        // the current selected directory, then the new file should go in that collection
        // because we should not allow the user to create nested collections
        if (nearestOperatorConfigFile && path.dirname(directory).includes(path.dirname(nearestOperatorConfigFile))) {
          collectionDirectory = path.dirname(nearestOperatorConfigFile);
        }
      }
    }
  }

  return [collectionDirectory, ambiguous];
}
