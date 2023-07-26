import * as vscode from 'vscode';
import {OpenShiftItem} from "../openshiftItems/openshiftItem";
import {KubernetesObj} from "../../kubernetes/kubernetes";

type TreeItem = OpenShiftItem | undefined | void;

export class OpenShiftTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private operatorName: string = "";
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem> = new vscode.EventEmitter<TreeItem>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem> = this._onDidChangeTreeData.event;


    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: OpenShiftItem): vscode.TreeItem {
        return element;
      }
      
    async getChildren(element?: OpenShiftItem): Promise<OpenShiftItem[]> {
        const links: Array<OpenShiftItem> = [];
        const k8s = new KubernetesObj();
        const userLoggedIntoOCP = await k8s.isUserLoggedIntoOCP();
        if (!element && userLoggedIntoOCP) {
            links.push(new OpenShiftItem("OpenShift Cluster", k8s.openshiftServerURL, new vscode.ThemeIcon("cloud"), "openshift-cluster"));
            links.push(new OpenShiftItem("OpenShift Namespace", k8s.namespace, new vscode.ThemeIcon("account"), "openshift-namespace"));
        }

        return links;
    } 
}