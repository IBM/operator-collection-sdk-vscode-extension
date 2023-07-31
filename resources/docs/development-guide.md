# IBM Operator Collection SDK for VS Code Development Guide <!-- omit from toc -->

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Local debugging](#local-debugging)
- [Making changes](#making-changes)
- [Explore the API](#explore-the-api)
- [Run tests](#run-tests)
- [Local builds](#local-builds)


## Local debugging
* Press `F5` to open a new window with your extension loaded.
* Run your command from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and typing `Hello World`.
* Set breakpoints in your code inside `src/extension.ts` to debug your extension.
* Find output from your extension in the debug console.

## Making changes
* You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Explore the API
* You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.

## Run tests
* Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown pick `Extension Tests`.
* Press `F5` to run the tests in a new window with your extension loaded.
* See the output of the test result in the debug console.
* Make changes to `src/test/suite/extension.test.ts` or create new test files inside the `test/suite` folder.
  * The provided test runner will only consider files matching the name pattern `**.test.ts`.
  * You can create folders inside the `test` folder to structure your tests any way you want.

## Local builds
* Run the following command to install the `vsce` package globally
    ```
    npm install -g @vscode/vsce
    ```
* Run the following command to build the `.vsix` file
    ```
    npm run build
    ```
* Run the following command to install the extenion to your VS Code editor
    ```
    npm run deploy
    ```