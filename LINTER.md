# IBM Operator Collection SDK for VS Code integrated linter configuration

The IBM Operator Collection SDK for VS Code has a built-in linter meant to validate your operator-config,
By default the following rules are applied:

- missing-galaxy
- match-domain
- match-name
- match-version
- ansible-config
- playbook-path
- hosts-all 
- missing-playbook
- finalizer-path
- missing-finalizer

You can customize the linter rules and files to ignore to suit your needs. You can ignore certain rules, enable rules, and ignore files from linting.

The IBM Operator Collection SDK for VS Code Operator Collection Linter loads configuration from a file in the directory where the operator-config is located,
Specify this configuration in `.oc-lint` a yaml file that contains the following format:

```
---
# .oc-lint

exclude_paths:
    - '**'

use_default_rules: true

skip_list:
    - match-domain
    
enable_list:
    - hosts-all
```

Where:
- `exlude_paths` defines a glob pattern to ignore when matching against the files the linter will process.
- `use_default_rules` Enables all the linting rules to be applied.
- `skip_list` Lists all the rules you want disabled.
- `enable_list` Lists all the rules you want to explicitly enable.
