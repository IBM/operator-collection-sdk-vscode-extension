// To preserve whitespace DO NOT reformat this file

export const playbookBoilerplateContent = `
---
- name: Boilerplate Playbook
  hosts: all
  gather_facts: false

  vars_files:
    - vars/variables.yaml

  vars:
    ansible_python_interpreter: /usr/bin/python3

  tasks:
  - name: Example Task
    debug:
      msg: Hello, world!

`;

export const variablesBoilerplateContent = `
example_variable_name: example_variable_value

`;

export const operatorConfigBoilerplateContent = `
domain: namespace
name: example
version: 0.0.0
roles:
  - apiGroups: ["route.openshift.io", ""]
    resources: ["routes", "secrets"]
    verbs: ["*"]
clusterRoles:
  - apiGroups: ["route.openshift.io", ""]
    resources: ["routes", "secrets"]
    verbs: ["*"]
displayName: Example Collection
description: >-
  # Example Collection

  A description for the collection.
resources:
  - kind: ExampleResource
    description: A description for a custom resource.
    playbook: playbooks/example_resource.yaml
    finalizer: playbooks/example_resource_finalizer.yaml
    vars:
      - name: exampleVariable
        displayName: Example Input Variable
        required: True
        description: >-
          The custom resource will create a route and secret.
        type: string
icon:
  - base64data: >-
      REPLACE WITH BASE64 ENCODED ICON
    mediatype: image/jpeg;base64

`;

export const galaxyBoilerplateContent = `
# See https://docs.ansible.com/ansible/latest/dev_guide/collections_galaxy_meta.html

### REQUIRED
# The namespace of the collection. This can be a company/brand/organization or product namespace under which all
# content lives. May only contain alphanumeric lowercase characters and underscores. Namespaces cannot start with
# underscores or numbers and cannot contain consecutive underscores
namespace: 

# The name of the collection. Has the same character restrictions as 'namespace'
name: 

# The version of the collection. Must be compatible with semantic versioning
version: 

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
