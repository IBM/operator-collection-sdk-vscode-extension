import * as vscode from "vscode";
import {KubernetesObj, ObjectInstance} from "../../kubernetes/kubernetes";
import * as icons from "../icons";

export class SubOperatorConfigsItem extends vscode.TreeItem {
    constructor(public readonly subOperatorConfigObj: ObjectInstance, public readonly link: string) {
        super(subOperatorConfigObj.metadata.name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = "suboperatorconfig-object";
        this.iconPath = icons.getBrokerObjectStatusIconPath(subOperatorConfigObj.status);
    }
}

export async function getSubOperatorConfigsItem(operatorName: string): Promise<SubOperatorConfigsItem[]> {
	const subOperatorConfigItems: Array<SubOperatorConfigsItem> = [];
	const k8s = new KubernetesObj();
    const consoleUrl = await k8s.getOpenshifConsoleUrl();
	const subOperatorConfigList = await k8s.getSubOperatorConfigs(operatorName);
	for (const subOperatorConfig of subOperatorConfigList.items) {
        let subOperatorConfigUrl = `https://${consoleUrl}/k8s/ns/${k8s.namespace}/zoscb.ibm.com~v2beta2~SubOperatorConfig/${subOperatorConfig.metadata.name}/yaml`;
		subOperatorConfigItems.push(new SubOperatorConfigsItem(subOperatorConfig, subOperatorConfigUrl));
	}
	return subOperatorConfigItems;
}