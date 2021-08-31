import {Command, flags} from '@oclif/command'
import {RegistryAccess, MetadataType, MetadataRegistry, registry as defaultRegistry, ComponentSet, MetadataConverter} from '@salesforce/source-deploy-retrieve';
import path = require('path');
import FileSystem from "../utils/FileSystem";
const glob = require("glob");
import * as fs from "fs-extra";

export default class Hello extends Command {
  static description = 'describe the command here'

  static examples = [
    `$ sfp hello
hello world from ./src/hello.ts!
`,
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    // flag with a value (-n, --name=VALUE)
    name: flags.string({char: 'n', description: 'name to print'}),
    // flag with no value (-f, --force)
    force: flags.boolean({char: 'f'}),
  }

  static args = [{name: 'file'}]
  private readonly registry: MetadataRegistry = defaultRegistry;
  // must be run within project directory

  async run() {
    const {args, flags} = this.parse(Hello)

    const name = flags.name ?? 'world'
    this.log(`hello ${name} from ./src/commands/hello.ts`)
    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`)
    }

    // console.log(this.getTypeBySuffix(flags.name as string));
    // let metadataType = this.getTypeBySuffix(flags.name as string)
    // let component = Object.assign(metadataType, {path: "src-temp", recommended: "src-access-management"});
    // this.moveComponentToPackage(component , "src-access-management");

    const converter = new MetadataConverter();
    const components = ComponentSet.fromSource("src-temp/objects/Account/fields/ABNACN__c.field-meta.xml");
    await converter.convert(components, 'source', {
      type: 'merge',
      mergeWith: ComponentSet.fromSource(path.resolve("packages/core-crm")).getSourceComponents(),
      defaultDirectory: 'packages/core-crm',
      forceIgnoredPaths: components.forceIgnoredPaths ?? new Set<string>()
    });
  }

  /**
   * Implement own method, as @salesforce/source-deploy-retrieve getTypeBySuffix does not walk through children
   * @param suffix
   */
  private getTypeBySuffix(suffix: string): MetadataType {
    let metadataType: MetadataType;

    outer:
    for (let type in this.registry.types) {

      if (this.registry.types[type].suffix === suffix) {
        metadataType = this.registry.types[type];
        break;
      } else if (this.registry.types[type].children) {
        let typesOfChildren = this.registry.types[type].children?.types;
        for (let type in typesOfChildren) {
          if (typesOfChildren[type].suffix === suffix) {
            metadataType = typesOfChildren[type];
            break outer;
          }
        }
      }
    }

    return metadataType;
  }

  private getMetadataSuffix(file: string): string {
    let metadataSuffix: string;

    const filename = path.basename(file);
    const match = filename.match(/\.(?<suffix>.+)-meta.xml$/i);
    if (match?.groups?.suffix) {
      metadataSuffix = match.groups.suffix;
    } else {
      metadataSuffix = "";
    }

    return metadataSuffix;
  }

  private moveComponentToPackage(component: Component, packageDir: string) {
    let directoryname: string;
    if (component.folderType) {
      let folderName = path.basename(path.dirname(component.path));
      directoryname = path.join(component.directoryName, folderName);
    } else directoryname = component.directoryName;

    // check whether component directory exists
    let directory = glob.sync(`${directoryname}/`, {
      cwd: packageDir,
      absolute: true
    });

    let filename = path.basename(component.path);
    if (directory.length === 1) {
      fs.moveSync(component.path, path.join(directory, filename), {overwrite: false});
    } else {
      let directory = path.join(packageDir, "main", "default", directoryname);
      fs.mkdirpSync(directory);
      fs.moveSync(component.path, path.join(directory, filename), {overwrite: false})
    }
    // const packageDirContents = FileSystem.readdirRecursive(packageDir);
    // // packageDirContents.forEach((elem) => )

    // // if (component.)
  }
}

interface Component extends MetadataType {
  // path of component
  path: string;
  recommended: string;
}