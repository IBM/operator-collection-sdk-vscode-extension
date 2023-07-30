# IBM Operator Collection SDK for VS Code

The IBM Operator Collection SDK extension simplifies the Operator Collection development experience by allowing you to manage the deployment of your operator in OpenShift, and the ability to debug direcly from your VS Code editor. 

## Features

## Deploy your operator to OpenShift with single-click actions
Single-click actions to Create, Re-deploy, and Delete your operator in OpenShift.

![Deploy and manage operator](./resources/docs/oc-sdk-actions.png)

## Monitor your operator status and resources directly from your VS Code editor
- Display the status of the operator pod, and each container within the pod.
- Download and view container logs directly from your VS Code editor.

![Download logs](./resources/docs/oc-sdk-download-logs.gif)

- Display the status of the OpenShift resources created to generate your operator (`OperatorCollections`, `SubOperatorConfigs`, `ZosEndpoints`).
- Create and monitor the Custom Resources for your operator.

![Monitor operator status](./resources/docs/oc-sdk-view-create-resources.gif)



## Manage your OpenShift cluster connection and project
Configure your OpenShift server URL, and select your OpenShift Project directly from your VS Code editor

![OpenShift configuration](./resources/docs/oc-sdk-openshift-connection.gif)


## Getting Started

1. Install the extension using the local install instructions



## Installing VS Code Extension
1. Download the `.vsix` file from the latest release in the [operator-collection-sdk-vscode-extension Github repository](https://github.com/IBM/operator-collection-sdk-vscode-extension/releases)
2. Install the extension to your VS Code editor using one of the following options below.
   - **Using the `code` CLI:**
        
        Execute the `extensionName=$(ls *.vsix) && code --install-extension ${extensionName}` command to install the VS Code extension to your editor
   - **Using the VS Code command palette:**
  
        1. From your VS Code editor, open the VS Code command palette by issuing the `CMD + SHIFT + P` command on Mac, or the `CTRL + SHIFT + P` command on Windows.
        2. Search for `Extensions` in the command palette, and click on the `Extensions: Install from VSIX` command
        3. Locate the `.vsix` file on your filesystem and click `Install`