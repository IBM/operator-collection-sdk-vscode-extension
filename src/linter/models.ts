/* Do not change, this code is generated from Golang structs */

export interface LabelSelectorRequirement {
  key: string;
  operator: string;
  values?: string[];
}
export interface LabelSelector {
  matchLabels?: { [key: string]: string };
  matchExpressions?: LabelSelectorRequirement[];
}
export interface AggregationRule {
  clusterRoleSelectors?: LabelSelector[];
}
export interface ClusterRole {
  kind?: string;
  apiVersion?: string;
  name?: string;
  generateName?: string;
  namespace?: string;
  selfLink?: string;
  uid?: string;
  resourceVersion?: string;
  generation?: number;
  creationTimestamp?: Time;
  deletionTimestamp?: Time;
  deletionGracePeriodSeconds?: number;
  labels?: { [key: string]: string };
  annotations?: { [key: string]: string };
  ownerReferences?: OwnerReference[];
  finalizers?: string[];
  managedFields?: ManagedFieldsEntry[];
  rules: PolicyRule[];
  aggregationRule?: AggregationRule;
}
export interface PolicyRule {
  verbs: string[];
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
}
export interface FieldsV1 {}
export interface ManagedFieldsEntry {
  manager?: string;
  operation?: string;
  apiVersion?: string;
  time?: Time;
  fieldsType?: string;
  fieldsV1?: FieldsV1;
  subresource?: string;
}
export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
  blockOwnerDeletion?: boolean;
}
export interface Time {}
export interface Role {
  kind?: string;
  apiVersion?: string;
  name?: string;
  generateName?: string;
  namespace?: string;
  selfLink?: string;
  uid?: string;
  resourceVersion?: string;
  generation?: number;
  creationTimestamp?: Time;
  deletionTimestamp?: Time;
  deletionGracePeriodSeconds?: number;
  labels?: { [key: string]: string };
  annotations?: { [key: string]: string };
  ownerReferences?: OwnerReference[];
  finalizers?: string[];
  managedFields?: ManagedFieldsEntry[];
  rules: PolicyRule[];
}
export interface IconData {
  base64data?: string;
  mediatype?: string;
}
export interface ObjectVariables {
  name?: string;
  description?: string;
  displayName?: string;
  type?: string;
  kindReference?: string;
  default?: string;
  options?: string[];
  required?: boolean;
}
export interface ResourceVariable {
  name?: string;
  description?: string;
  displayName?: string;
  type?: string;
  kindReference?: string;
  default?: string;
  options?: string[];
  required?: boolean;
  objectVariables?: ObjectVariables[];
  array?: boolean;
}
export interface OperatorResource {
  description?: string;
  displayName?: string;
  kind?: string;
  playbook?: string;
  vars?: ResourceVariable[];
  finalizer?: string;
  hideResource?: boolean;
}
export interface OperatorConfig {
  description?: string;
  displayName?: string;
  domain?: string;
  name?: string;
  provider?: string;
  migrationPlaybook?: string;
  resources?: OperatorResource[];
  version?: string;
  icon?: IconData[];
  replaces?: string;
  collectionPath?: string;
  roles?: Role[];
  clusterRoles?: ClusterRole[];
}
