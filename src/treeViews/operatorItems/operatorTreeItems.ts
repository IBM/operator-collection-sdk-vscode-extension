import * as vscode from 'vscode';

export abstract class OperatorTreeItem extends vscode.TreeItem {
    contextValue = 'operator-tree-item';
}