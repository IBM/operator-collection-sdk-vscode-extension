import * as vscode from "vscode";
import * as k8s from '@kubernetes/client-node';
import {ObjectStatus} from "../kubernetes/kubernetes";

type Icons = {
    "dark": vscode.Uri,
    "light": vscode.Uri
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
        return undefined;
    }
}

export function getBrokerObjectStatusIcon(status: ObjectStatus): ThemeIcons {
    switch (status.phase) {
        case "Successful": {
            return getPassingIcons();
        }
        case "Failed": {
            return getFailingIcons();
        }
        case "Pending": {
            return getPendingIcons();
        }
        default: {
            return getFailingIcons();
        }
    }
}

export function getOperatorStatusIcon() {}

function getPassingIcons(): Icons {
    let icons: Icons = {
        dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", "pass.svg"),
        light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", "pass.svg")
    };
    return icons;
}

function getFailingIcons(): Icons {
    let icons: Icons = {
        dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", "error.svg"),
        light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", "error.svg")
    };
    return icons;
}

function getPendingIcons(): vscode.ThemeIcon {
    return new vscode.ThemeIcon("loading~spin");
}