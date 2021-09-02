sfp-cli
=======

sfpowerscripts CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/sfp-cli.svg)](https://npmjs.org/package/sfp-cli)
[![Downloads/week](https://img.shields.io/npm/dw/sfp-cli.svg)](https://npmjs.org/package/sfp-cli)
[![License](https://img.shields.io/npm/l/sfp-cli.svg)](https://github.com/dxatscale/sfp-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g sfp-cli
$ sfp COMMAND
running command...
$ sfp (-v|--version|version)
sfp-cli/0.0.0 darwin-x64 node-v12.16.0
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

_See code: [src/commands/pull.ts](https://github.com/dxatscale/sfp-cli/blob/v0.0.0/src/commands/pull.ts)_
<!-- commandsstop -->
