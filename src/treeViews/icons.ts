/*
 * Copyright 2023 IBM Inc. All rights reserved
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from "vscode";
import * as k8s from "@kubernetes/client-node";
import { CustomResourcePhases } from "../utilities/commandConstants";
import { ObjectInstance } from "../kubernetes/kubernetes";

type Icons = {
  dark: vscode.Uri;
  light: vscode.Uri;
};

type ThemeIcons = vscode.ThemeIcon | Icons | undefined;

let _context: vscode.ExtensionContext;
export function initResources(context: vscode.ExtensionContext) {
  _context = context;
}

export function getPodStatusIcon(containerStatuses: Array<k8s.V1ContainerStatus>): ThemeIcons {
  let runningContainers: number = 0;
  let failingContainers: number = 0;
  let pendingContainers: number = 0;
  for (const containerStatus of containerStatuses) {
    const containerState = containerStatus.state;
    if (containerState?.running) {
      runningContainers++;
    } else if (containerState?.waiting) {
      pendingContainers++;
    } else if (containerState?.terminated) {
      if (containerStatus.name.startsWith("init")) {
        runningContainers++;
      } else {
        failingContainers++;
      }
    } else {
      pendingContainers++;
    }
  }
  if (pendingContainers > 0) {
    return getPendingIcons();
  } else if (failingContainers > 0) {
    return getFailingIcons();
  } else if (runningContainers > 0) {
    return getPassingIcons();
  } else {
    return undefined;
  }
}

export function getPodContainerStatusIcon(containerStatus: k8s.V1ContainerStatus): ThemeIcons {
  const containerState = containerStatus.state;
  if (containerState?.running) {
    return getPassingIcons();
  } else if (containerState?.waiting) {
    return getPendingIcons();
  } else if (containerState?.terminated) {
    if (containerStatus.name.startsWith("init")) {
      return getPassingIcons();
    } else {
      return getFailingIcons();
    }
  } else {
    return getPendingIcons();
  }
}

export function getCustomResourceStatusIcon(customResourceObj: ObjectInstance): ThemeIcons {
  if (customResourceObj.metadata.deletionTimestamp) {
    return getPendingIcons();
  }

  if (!customResourceObj.status?.phase) {
    return getPendingIcons();
  }
  switch (customResourceObj.status?.phase) {
    case CustomResourcePhases.successful: {
      return getPassingIcons();
    }
    case CustomResourcePhases.succeeded: {
      return getPassingIcons();
    }
    case CustomResourcePhases.failed: {
      return getFailingIcons();
    }
    case CustomResourcePhases.pending: {
      return getPendingIcons();
    }
    default: {
      return getFailingIcons();
    }
  }
}

export function getPassingIcons(): Icons {
  let icons: Icons = {
    dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", "pass.svg"),
    light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", "pass.svg"),
  };
  return icons;
}

export function getFailingIcons(): ThemeIcons {
  let icons: Icons = {
    dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", "error.svg"),
    light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", "error.svg"),
  };
  return icons;
}

export function getPendingIcons(): ThemeIcons {
  return new vscode.ThemeIcon("loading~spin");
}

export function getOperatorCollectionSdkIcons(): ThemeIcons {
  let icons: Icons = {
    dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", "operator-collection-sdk.svg"),
    light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", "operator-collection-sdk.svg"),
  };
  return icons;
}

export function getBrokerIcons(): ThemeIcons {
  let icons: Icons = {
    dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", "broker.svg"),
    light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", "broker.svg"),
  };
  return icons;
}
