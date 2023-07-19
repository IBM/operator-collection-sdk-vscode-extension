import * as vscode from "vscode";
import * as k8s from '@kubernetes/client-node';

type Icons = {
    "dark": vscode.Uri,
    "light": vscode.Uri
};

let _context: vscode.ExtensionContext;
export function initResources(context: vscode.ExtensionContext) {
  _context = context;
}

export function getPodStatusIconPath(containerStatuses: Array<k8s.V1ContainerStatus>): Icons | undefined {
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

export function getPodContainerStatusIconPath(containerStatus: k8s.V1ContainerStatus): Icons | undefined {
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

function getPendingIcons(): Icons {
    let icons: Icons = {
        dark: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "dark", "loading.svg"),
        light: vscode.Uri.joinPath(_context.extensionUri, "resources", "icons", "light", "loading.svg")
    };
    return icons;
}