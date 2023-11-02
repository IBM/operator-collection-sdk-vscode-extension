/* Do not change, this code is generated from Golang structs */
export interface PolicyRule {
  verbs: string[];
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  nonResourceURLs?: string[];
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
  roles?: PolicyRule[];
  clusterRoles?: PolicyRule[];
}
