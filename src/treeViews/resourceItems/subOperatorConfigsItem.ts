
export async function getSubOperatorConfigsItem(operatorName: string): Promise<SubOperatorConfigsItem[]> {
	const subOperatorConfigItems: Array<SubOperatorConfigsItem> = [];
	const k8s = new KubernetesObj();
	const subOperatorConfigList = await k8s.getSubOperatorConfigs(operatorName);
	if (subOperatorConfigList) {
		for (const subOperatorConfig of subOperatorConfigList.items) {
			let subOperatorConfigUrl = await k8s.getResourceUrl(util.ZosCloudBrokerKinds.subOperatorConfig, util.zosCloudBrokerGroup, util.subOperatorConfigApiVersion, subOperatorConfig.metadata.name);
			subOperatorConfigItems.push(new SubOperatorConfigsItem(subOperatorConfig, subOperatorConfigUrl));
		}
	}
	return subOperatorConfigItems;
}