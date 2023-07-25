import * as vscode from 'vscode';

export abstract class ResourceTreeItem extends vscode.TreeItem {
    contextValue = 'resource-tree-item';
}