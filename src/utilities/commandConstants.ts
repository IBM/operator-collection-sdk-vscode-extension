/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

export enum VSCodeCommands {
  sdkInstalled = "operator-collection-sdk.sdkInstalled",
  sdkOutdatedVersion = "operator-collection-sdk.sdkOutdatedVersion",
  zosCloudBrokerInstalled = "operator-collection-sdk.zosCloudBrokerInstalled",
  sdkUpgradeVersion = "operator-collection-sdk.sdkUpgradeVersion",
  sdkUpgradeVersionSkip = "operator-collection-sdk.sdkUpgradeVersionSkip",
  loggedIn = "operator-collection-sdk.loggedIn",
  validNamespace = "operator-collection-sdk.validNamespace",
  login = "operator-collection-sdk.login",
  logout = "operator-collection-sdk.logout",
  install = "operator-collection-sdk.install",
  updateProject = "operator-collection-sdk.updateProject",
  createOperator = "operator-collection-sdk.createOperator",
  deleteOperator = "operator-collection-sdk.deleteOperator",
  redeployCollection = "operator-collection-sdk.redeployCollection",
  redeployOperator = "operator-collection-sdk.redeployOperator",
  deleteCustomResource = "operator-collection-sdk.deleteCustomResource",
  viewLogs = "operator-collection-sdk.viewLogs",
  viewVerboseLogs = "operator-collection-sdk.viewVerboseLogs",
  viewResource = "operator-collection-sdk.viewResource",
  openEditLink = "operator-collection-sdk.openEditLink",
  openAddLink = "operator-collection-sdk.openAddLink",
  openLink = "operator-collection-sdk.openLink",
  refresh = "operator-collection-sdk.refresh",
  resourceRefresh = "operator-collection-sdk.resourceRefresh",
  refreshAll = "operator-collection-sdk.refreshAll",
  refreshOpenShiftInfo = "operator-collection-sdk.refreshOpenShiftInfo",
  refreshContainerLog = "operator-collection-sdk.refreshContainerLog",
  refreshVerboseContainerLog = "operator-collection-sdk.refreshVerboseContainerLog",
  createFile = "operator-collection-sdk.createFile",
  createGalaxyBoilerplateFile = "operator-collection-sdk.createGalaxyBoilerplateFile",
  createOperatorConfigBoilerplateFile = "operator-collection-sdk.createOperatorConfigBoilerplateFile",
  createPlaybookBoilerplateFile = "operator-collection-sdk.createPlaybookBoilerplateFile",
  inlineReplaceWith = "operator-collection-sdk.refactorInline",
}

export enum VSCodeDiagnosticMessages {
  invalidPlaybookError = "Invalid Playbook for Kind",
  invalidFinalizerError = "Invalid Finalizer for Kind",
}

export enum VSCodeViewIds {
  operators = "operator-collection-sdk.operators",
  resources = "operator-collection-sdk.resources",
  help = "operator-collection-sdk.help",
  openshiftClusterInfo = "operator-collection-sdk.openshiftClusterInfo",
  about = "operator-collection-sdk.about",
}

export enum CustomResourcePhases {
  successful = "Successful",
  succeeded = "Succeeded",
  failed = "Failed",
  pending = "Pending",
}
