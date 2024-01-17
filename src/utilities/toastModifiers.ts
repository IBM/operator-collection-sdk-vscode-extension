import * as vscode from "vscode";

const toastActions = {
  copy: { title: "copy", isCloseAffordance: false },
};

/**
 * Displays error message toast with copy button that allows users to copy the error message
 * @param message - Message to be displayed in the toast notification.
 * @returns
 */
export function showErrorMessage(message: string, ...items: any[]) {
  vscode.window.showErrorMessage(message, toastActions.copy, ...items).then(selection => {
    if (selection === toastActions.copy) {
      vscode.env.clipboard.writeText(message);
    }
  });
}
