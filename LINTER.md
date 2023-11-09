# IBM Operator Collection SDK for VS Code integrated linter configuration

The IBM Operator Collection SDK for VS Code has a built-in linter meant to validate your operator-config,
By default the following rules are applied:

- `missing-galaxy`
  - Missing `galaxy.yaml` file errors.
- `match-domain`
  - `galaxy.yml` file `domain` mismatch
- `match-name`
  - `galaxy.yml` file `name` mismatch
- `match-version`
  - `galaxy.yml` file `version` mismatch
- `ansible-config`
  - Build includes `ansible.cfg` error
- `playbook-path`
  - Playbook relative path validation error
- `hosts-all`
  - Playbook hosts validation
- `missing-playbook`
  - Validate Playbook existence
- `finalizer-path`
  - Finalizer relative path validation error
- `missing-finalizer`
  - Validate Finalizer existence

You can customize the linter rules and files to ignore to suit your needs. You can ignore certain rules, enable rules, and ignore files from linting.

The IBM Operator Collection SDK for VS Code Operator Collection Linter loads configuration from a file in the directory where the operator-config is located,
Specify this configuration in `.oc-lint` a yaml file that contains the following format:

```
---
# .oc-lint

# List of files for the linter to ignore.
exclude_paths:
    - '**'

# Use all the default linter rules
use_default_rules: true

# List of rules to skip linting.
skip_list:
    - match-domain

# List of additional rules to enable.
enable_list:
    - hosts-all
```

Where:
- `exlude_paths` defines a glob pattern to ignore when matching against the files the linter will process.
- `use_default_rules` Enables all the linting rules to be applied.
- `skip_list` Lists all the rules you want disabled.
- `enable_list` Lists all the rules you want to explicitly enable.
