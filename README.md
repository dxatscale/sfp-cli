sfp-cli
=======

PRE-ALPHA Developer CLI for Salesforce programs following the DX@Scale model

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/@dxatscale/sfp-cli.svg)](https://npmjs.org/package/@dxatscale/sfp-cli)
[![Downloads/week](https://img.shields.io/npm/dw/@dxatscale/sfp-cli.svg)](https://npmjs.org/package/@dxatscale/sfp-cli)
[![License](https://img.shields.io/npm/l/@dxatscale/sfp-cli.svg)](https://github.com/dxatscale/sfp-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g @dxatscale/sfp-cli
$ sfp COMMAND
running command...
$ sfp (-v|--version|version)
@dxatscale/sfp-cli/0.0.11 darwin-x64 node-v14.16.1
$ sfp --help [COMMAND]
USAGE
  $ sfp COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`sfp help [COMMAND]`](#sfp-help-command)
* [`sfp init [CALLER] [MODE]`](#sfp-init-caller-mode)
* [`sfp sync [FILE]`](#sfp-sync-file)
* [`sfp update [CHANNEL]`](#sfp-update-channel)
* [`sfp workitem [FILE]`](#sfp-workitem-file)

## `sfp help [COMMAND]`

display help for sfp

```
USAGE
  $ sfp help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.2.3/src/commands/help.ts)_

## `sfp init [CALLER] [MODE]`

describe the command here

```
USAGE
  $ sfp init [CALLER] [MODE]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/init.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.11/src/commands/init.ts)_

## `sfp sync [FILE]`

sync changes effortlessly either with repository or development environment

```
USAGE
  $ sfp sync [FILE]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/sync.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.11/src/commands/sync.ts)_

## `sfp update [CHANNEL]`

update the sfp CLI

```
USAGE
  $ sfp update [CHANNEL]

OPTIONS
  --from-local  interactively choose an already installed version
```

_See code: [@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v1.5.0/src/commands/update.ts)_

## `sfp workitem [FILE]`

create/switch/submit a workitem

```
USAGE
  $ sfp workitem [FILE]

OPTIONS
  -h, --help  show CLI help
```

_See code: [src/commands/workitem.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.11/src/commands/workitem.ts)_
<!-- commandsstop -->
