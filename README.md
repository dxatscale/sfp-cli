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
@dxatscale/sfp-cli/0.0.1 darwin-x64 node-v12.16.0
$ sfp --help [COMMAND]
USAGE
  $ sfp COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`sfp help [COMMAND]`](#sfp-help-command)
* [`sfp pull`](#sfp-pull)
* [`sfp update [CHANNEL]`](#sfp-update-channel)

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

## `sfp pull`

Pull source from scratch org to the project. Provides interactive interface for packaging new metadata.

```
USAGE
  $ sfp pull

OPTIONS
  -f, --forceoverwrite                 ignore conflict warnings and overwrite changes to the project
  -h, --help                           show CLI help
  -u, --targetusername=targetusername  username or alias for the target org

EXAMPLE
  $ sfp pull -u <scratchorg>
```

_See code: [src/commands/pull.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.1/src/commands/pull.ts)_

## `sfp update [CHANNEL]`

update the sfp CLI

```
USAGE
  $ sfp update [CHANNEL]

OPTIONS
  --from-local  interactively choose an already installed version
```

_See code: [@oclif/plugin-update](https://github.com/oclif/plugin-update/blob/v1.5.0/src/commands/update.ts)_
<!-- commandsstop -->
