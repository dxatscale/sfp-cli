import {Command, flags} from '@oclif/command'
import {RegistryAccess, MetadataType, MetadataRegistry, registry as defaultRegistry, ComponentSet, MetadataConverter, MetadataResolver} from '@salesforce/source-deploy-retrieve';
import path = require('path');
import FileSystem from "../utils/FileSystem";
const glob = require("glob");
import * as fs from "fs-extra";
import child_process = require("child_process");
import inquirer = require('inquirer');
inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
const fuzzy = require("fuzzy");
import * as resource from "../resource.json";

export default class Pull extends Command {
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
    targetusername: flags.string({char: 'u'})
  }

  static args = [{name: 'file'}]
  private readonly registry: MetadataRegistry = defaultRegistry;
  // must be run within project directory

  async run() {
    const {args, flags} = this.parse(Pull);
    const remoteAdditions = this.getRemoteAdditions(flags.targetusername);
    // TODO: Check for conflicts
    if (remoteAdditions.length === 0) {
      console.log("No changes found");
      return;
    }

    console.log(`Found ${remoteAdditions.length} new metadata components`);
    const defaultPackage = ProjectConfig.getDefaultSFDXPackageDescriptor(null);

    let result = [];
    for (let remoteAddition of remoteAdditions) {
      const obj = {
        fullName: remoteAddition.fullName,
        type: remoteAddition.type,
        destination: null
      };

      let getMoveAction = await inquirer.prompt({
        type: "list",
        name: "moveAction",
        message: `Select a package for ${obj.type} ${obj.fullName}?`,
        choices: this.getChoicesForMovingMetadata(obj),
      });
      console.log(getMoveAction);

      if(getMoveAction.moveAction === MoveAction.RECOMMENDED) {
        obj.destination = resource.types[obj.type].recommended;
      } else if (getMoveAction.moveAction === MoveAction.EXISTING) {
        let getExistingPackage = await inquirer.prompt([{
          type: "autocomplete",
          name: "package",
          message: "Search for package",
          source: this.searchExistingPackages
        }]);
        console.log(getExistingPackage);

        let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(null, getExistingPackage.package);
        obj.destination = packageDescriptor.path;
      } else if (getMoveAction.moveAction === MoveAction.NOTHING) {
        continue;
      } else {
        throw new Error(`Unrecognised MoveAction ${getMoveAction.moveAction}`);
      }
      result.push(obj);
    }

    console.log(result);

    child_process.execSync(
      `sfdx force:source:pull -u ${flags.targetusername} -f`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024*1024*5
      }
    );

    const componentsFromDefaultPackage =  new MetadataResolver().getComponentsFromPath(defaultPackage.path);

    //
    for (let elem of result) {
      let component = componentsFromDefaultPackage.find((component) => component.name === elem.fullName && component.type.name === elem.type);

      const converter = new MetadataConverter();
      const components = ComponentSet.fromSource(component.xml);

      await converter.convert(components, 'source', {
        type: 'merge',
        mergeWith: ComponentSet.fromSource(path.resolve(elem.destination)).getSourceComponents(),
        defaultDirectory: elem.destination,
        forceIgnoredPaths: components.forceIgnoredPaths ?? new Set<string>()
      });

      fs.unlinkSync(component.xml);
      if (component.content) {
        fs.unlinkSync(component.content);
      }
    }
    // let getSomething = await inquirer.prompt([{type: "list", name: "something", message: "Wtf?", choices: [{name: "product A", value: "A"}]}]);
    // console.log(getSomething);
    const name = flags.name ?? 'world'
    this.log(`hello ${name} from ./src/commands/hello.ts`)
    if (args.file && flags.force) {
      this.log(`you input --force and --file: ${args.file}`)
    }


    // console.log(this.getTypeBySuffix(flags.name as string));
    // let metadataType = this.getTypeBySuffix(flags.name as string)
    // let component = Object.assign(metadataType, {path: "src-temp", recommended: "src-access-management"});
    // this.moveComponentToPackage(component , "src-access-management");



  }

  private getChoicesForMovingMetadata(metadata) {
    if (resource.types[metadata.type]?.recommended) {
      return [
        { name: `Recommended (${resource.types[metadata.type].recommended})`, value: MoveAction.RECOMMENDED },
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "Do nothing", value: MoveAction.NOTHING },
      ];
    } else {
      return [
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "Do nothing", value: MoveAction.NOTHING },
      ];
    }

  }

  /**
   * Fuzzy search for existing packages in the sfdx-project.json
   * @param answers
   * @param input
   * @returns
   */
  private searchExistingPackages(answers, input) {
    const packages = ProjectConfig.getAllPackages(null);
    if (input) {
      return fuzzy.filter(input, packages).map((elem) => elem.string);
    } else return packages;
  }
  private getRemoteAdditions(targetOrg: string) {
    let resultJson = child_process.execSync(
      `sfdx force:source:status -u ${targetOrg} --json`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024*1024*5
      }
    );

    let result = JSON.parse(resultJson);
    return result.result.filter((elem) => elem.state === "Remote Add");
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

enum MoveAction {
  RECOMMENDED = "recommended",
  NEW = "new",
  EXISTING = "existing",
  NOTHING = "nothing"
}

interface Component extends MetadataType {
  // path of component
  path: string;
  recommended: string;
}