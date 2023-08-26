/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

export enum VSCodeCommands {
	sdkInstalled = "operator-collection-sdk.sdkInstalled",
	loggedIn = "operator-collection-sdk.loggedIn",
	login = "operator-collection-sdk.login",
	install = "operator-collection-sdk.install",
	updateProject = "operator-collection-sdk.updateProject",
	createOperator = "operator-collection-sdk.createOperator",
	deleteOperator = "operator-collection-sdk.deleteOperator",
	redeployCollection = "operator-collection-sdk.redeployCollection",
	redeployOperator = "operator-collection-sdk.redeployOperator",
	deleteCustomResource = "operator-collection-sdk.deleteCustomResource",
	downloadLogs = "operator-collection-sdk.downloadLogs",
	followLogs = "operator-collection-sdk.followLogs",
	downloadVerboseLogs = "operator-collection-sdk.downloadVerboseLogs",
	openEditLink = "operator-collection-sdk.openEditLink",
	openAddLink = "operator-collection-sdk.openAddLink",
	openLink = "operator-collection-sdk.openLink",
	refresh = "operator-collection-sdk.refresh",
	resourceRefresh = "operator-collection-sdk.resourceRefresh",
	refreshAll = "operator-collection-sdk.refreshAll"
}

export enum VSCodeViewIds {
	operators = "operator-collection-sdk.operators",
	resources = "operator-collection-sdk.resources",
	help = "operator-collection-sdk.help",
	openshiftClusterInfo = "operator-collection-sdk.openshiftClusterInfo"
}

export enum CustomResourcePhases {
	successful = "Successful",
	succeeded = "Succeeded",
	failed = "Failed",
	pending = "Pending"
}