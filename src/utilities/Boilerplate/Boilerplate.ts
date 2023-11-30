// To preserve whitespace DO NOT reformat this file

export const playbookBoilerplateContent = `---
- name: Auto generated playbook

  # Operator Collection's target hosts are driven using z/OS Endpoints provided by the IBM z/OS Cloud Broker.
  # For this reason, the playbook MUST use the "hosts: all" parameter
  # When the Ansible Playbook is executed by the IBM z/OS Cloud Broker, the hosts: all value is limited to the selected z/OS Endpoint by setting the --limit flag. 
  # This is done internally by the IBM z/OS Cloud Broker and no additional playbook modifications must be made to handle host limiting.
  hosts: all
  gather_facts: false
  vars_files:
    - vars/my_vars.yml
    
  tasks:
    # Add playbook tasks below

`;

export const operatorConfigBoilerplateContent = (name: string, domain: string, version: string) => {
  return `# (Required) A unique value that will be used to construct the Kubernetes API group for the resources defined in this OperatorCollection
domain: ${domain}

# (Required) A unique value that will be prepended to the domain value to construct a full Kubernetes API Group for the resources defined in this OperatorCollection
name: ${name}

# (Required) A semantic versioning compliant version number.
# This value SHOULD be the same as the version value specified in an Ansible Collection's galaxy.yml file.
version: ${version}

# (Required) A short name that will be displayed in OperatorHub for the generated OperatorCollection tile.
displayName: Add Display Name Here

# (Optional) A markdown formatted string that provides information regarding the OperatorCollection and it's functionality within the OCP cluster. The markdown content MUST provide a new line after headers for proper compatibility within OCP.
description: Add Description Here

# (Optional) A base64-encoded icon unique to the Operator
# icon:
  #  (Required) The based64-encoded image string
  # - base64data: ""

    # (Required) The media type of the base64-encoded image
    # mediatype: image/svg+xml

# (Required) A list of Kubernetes resources managed by this OperatorCollection
resources:
    # (Required) A functional name for the automation that will be managed by this Operator resource. This value MUST be Pascal Case (e.g. SomeMiddleware).
  - kind: AddKindHere
    
    # (Optional) A short name that will be displayed in OperatorHub for the generated OperatorCollection tile.
    # If a value is not provided, the tile in OCP will use the value given to the kind.
    displayName: Add display name here

    # (Optional) A short description of what this resource enables or performs.
    description: Add description here

    # (Required) The path to the Ansible Playbook that will be triggered for managing this resource. This path MUST be relative to the root of the Ansible Collection archive. An Ansible Collection with a playbook called run.yml in a playbooks directory would specify playbooks/run.yml for this value.
    # The playbook MUST use a hosts: all value. When z/OS Cloud Broker executes this playbook, the list of target hosts will be set to the z/OS Endpoint selected.    
    playbook: playbooks/playbook.yml

    # (Optional) An Ansible Playbook MAY be provided that will be triggered when a resource is deleted from Kubernetes. This playbook MAY reference the same value specified in playbook or provide a secondary playbook to run for deletion actions.
    # If a finalizer is not provided, Kubernetes will perform clean-up of the references managed within Kubernetes, but resources in z/OS MAY become orphaned.
    # finalizer: playbooks/my-deprovision-playbook.yml

    # (Optional) Specifies whether the current resource should be hidden in the OCP "Installed Operators" view.
    # hideResource: true

    # (Optional) A list of variables that SHOULD be provided during playbook invocation. See Resource Variables.
    vars:
        # (Required) The variable name that SHALL be provided to the defined playbook as an "extra vars" (-e) input parameter during execution. The provided value MUST conform to an existing variable referenced in the playbook or underlying Ansible role.
      - name: exampleVar

        # (Required) A short label that SHALL be visible in the OCP Kubernete's Custom Resource creation UIs.
        displayName: Example Variable

        # (Optional) A short description that SHALL be visible in the OCP Kubernetes Custom Resource creation UIs under the provided displayName. This value MUST provide any relevant information for users to understand the purpose for the provided var.
        description: >-
          Add description here

        # (Required) The variable type as is needed to be passed down to the Ansible playbook. Valid values for this include string, number, integer, boolean, password.
        # The password type will generate a dropdown list of the Secrets in the current namespace. This variable should be a reference to the Secret name selected by the user, in which the playbook/role should retrieve this Secret to read the private data.
        # Enums (or "dropdowns") are also supported by setting type: string and providing an additional options field.
        type: string

        # (Optional) Set this field to true if this variable MUST be input by the user before resource creation is allowed.
        # required: true

        # (Optional) A default value that should be set in the OCP UIs for this variable.
        # default: add default value here 

        # (Optional) A list of valid strings to specify the available options for an enum ("dropdown") type.
        # options: []

        # (Optional) Specify this field if the playbook requires information from other Kubernetes resources managed by the z/OS Cloud Broker.
        # This will enable a dynamically populated dropdown in the OCP UIs containing all previously created instances of the specified kind. Use this for running actions against previously created instances.
        # kindReference: AddReferencedKindHere
`;
};

export const galaxyBoilerplateContent = (name: string, namespace: string, version: string) => {
  return `
# See https://docs.ansible.com/ansible/latest/dev_guide/collections_galaxy_meta.html

### REQUIRED
# The namespace of the collection. This can be a company/brand/organization or product namespace under which all
# content lives. May only contain alphanumeric lowercase characters and underscores. Namespaces cannot start with
# underscores or numbers and cannot contain consecutive underscores
namespace: ${namespace}

# The name of the collection. Has the same character restrictions as 'namespace'
name: ${name}

# The version of the collection. Must be compatible with semantic versioning
version: ${version}

# The path to the Markdown (.md) readme file. This path is relative to the root of the collection
readme: README.md

# A list of the collection's content authors. Can be just the name or in the format 'Full Name <email> (url)
# @nicks:irc/im.site#channel'
authors:
- 


### OPTIONAL but strongly recommended
# A short summary description of the collection
description: 

# The path to the license file for the collection. This path is relative to the root of the collection. This key is
# mutually exclusive with 'license'
license_file: LICENSE

# A list of tags you want to associate with the collection for indexing/searching. A tag name has the same character
# requirements as 'namespace' and 'name'
tags:
  - example

# Collections that this collection requires to be installed for it to be usable. The key of the dict is the
# collection label 'namespace.name'. The value is a version range
# L(specifiers,https://python-semanticversion.readthedocs.io/en/latest/#requirement-specification). Multiple version
# range specifiers can be set and are separated by ','
dependencies: {}

# The URL of the originating SCM repository
repository: https://github.com/example

# The URL to any online docs
documentation: https://github.com/example/README.md

# The URL to the homepage of the collection/project
homepage: https://github.com/example

# The URL to the collection issue tracker
issues: https://github.com/example/issues

# A list of file glob-like patterns used to filter any files or directories that should not be included in the build
# artifact. A pattern is matched from the relative path of the file or directory of the collection directory. This
# uses 'fnmatch' to match the files or directories. Some directories and files like 'galaxy.yml', '*.pyc', '*.retry',
# and '.git' are always filtered. Mutually exclusive with 'manifest'
build_ignore:
  - local

# A dict controlling use of manifest directives used in building the collection artifact. The key 'directives' is a
# list of MANIFEST.in style
# L(directives,https://packaging.python.org/en/latest/guides/using-manifest-in/#manifest-in-commands). The key
# 'omit_default_directives' is a boolean that controls whether the default directives are used. Mutually exclusive
# with 'build_ignore'
# manifest: null

`;
};
