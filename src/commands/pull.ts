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
const Table = require("cli-table");

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
    forceoverwrite: flags.boolean({char: 'f'}),
    targetusername: flags.string({char: 'u'})
  }

  static args = [{name: 'file'}]
  private readonly registry: MetadataRegistry = defaultRegistry;

  async run() {
    const {args, flags} = this.parse(Pull);

    // TODO: Move to property requiresProject: boolean
    if (!fs.existsSync("sfdx-project.json")) throw new Error("This command must be run in the root directory of a SFDX project");

    const statusResult = this.getStatusResult(flags.targetusername, flags.forceoverwrite);
    const remoteAdditions = statusResult.filter((elem) => elem.state === "Remote Add");

    // TODO: Check for conflicts
    if (remoteAdditions.length === 0) {
      console.log("No changes found");
      return;
    }

    console.log(`Found ${remoteAdditions.length} new metadata components, which require a new home`);
    const defaultPackage = ProjectConfig.getDefaultSFDXPackageDescriptor(null);

    let result = [];
    for (let remoteAddition of remoteAdditions) {
      console.log();
      const obj: Instruction = {
        fullName: remoteAddition.fullName,
        type: remoteAddition.type,
        destination: []
      };

      let getMoveAction = await this.getMoveAction(obj);

      if(getMoveAction.moveAction === MoveAction.RECOMMENDED) {
        if (resource.types[obj.type].strategy === Strategy.PLUS_ONE) {
          obj.destination.push(...resource.types[obj.type].recommended);
          await this.getPlusOneMoveAction(obj);
        } else if (resource.types[obj.type].strategy === Strategy.DUPLICATE) {
          obj.destination.push(...resource.types[obj.type].recommended);
        } else if (resource.types[obj.type].strategy === Strategy.SINGLE) {
          await this.getSingleMoveAction(obj, resource.types[obj.type].recommended);
        } else if (resource.types[obj.type].strategy === Strategy.DELETE) {
          // do nothing
        } else {
          throw new Error("Strategy not defined or unknown");
        }
      } else if (getMoveAction.moveAction === MoveAction.NEW) {
        await this.getNewpackage(obj);
      } else if (getMoveAction.moveAction === MoveAction.EXISTING) {
        await this.getExistingPackage(obj);
      } else if (getMoveAction.moveAction === MoveAction.NOTHING) {
        continue;
      } else {
        throw new Error(`Unrecognised MoveAction ${getMoveAction.moveAction}`);
      }
      result.push(obj);
    }

    console.log('Pulling source components...');
    child_process.execSync(
      `sfdx force:source:pull -u ${flags.targetusername} -f`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024*1024*5
      }
    );
    console.log('Successfully pulled source components');


    console.log("Moving source components...")
    const componentsFromDefaultPackage =  new MetadataResolver().getComponentsFromPath(defaultPackage.path);
    //
    for (let elem of result) {
      let component = componentsFromDefaultPackage.find((component) => component.name === elem.fullName && component.type.name === elem.type);

      const converter = new MetadataConverter();
      const components = ComponentSet.fromSource(component.xml);

      for(let dest of elem.destination) {
        if (dest.aliasfy) {
          let files = fs.readdirSync(dest.package);
          let aliases = files.filter((file) => {
            let filepath = path.join(dest.package, file);
            return fs.lstatSync(filepath).isDirectory();
          });

          for (let alias of aliases) {
            await converter.convert(components, 'source', {
              type: 'merge',
              mergeWith: ComponentSet.fromSource(path.resolve(dest.package, alias)).getSourceComponents(),
              defaultDirectory: path.join(dest.package, alias),
              forceIgnoredPaths: components.forceIgnoredPaths ?? new Set<string>()
            });
          }
        } else {
          await converter.convert(components, 'source', {
            type: 'merge',
            mergeWith: ComponentSet.fromSource(path.resolve(dest.package)).getSourceComponents(),
            defaultDirectory: dest.package,
            forceIgnoredPaths: components.forceIgnoredPaths ?? new Set<string>()
          });
        }
      }


      fs.unlinkSync(component.xml);
      if (component.content) {
        fs.unlinkSync(component.content);
      }
    }


    console.log("Successfully moved source components");
    // let getSomething = await inquirer.prompt([{type: "list", name: "something", message: "Wtf?", choices: [{name: "product A", value: "A"}]}]);
    // console.log(getSomething);
    const name = flags.name ?? 'world'
    this.log(`hello ${name} from ./src/commands/hello.ts`)
    if (args.file) {
      this.log(`you input --force and --file: ${args.file}`)
    }


    // console.log(this.getTypeBySuffix(flags.name as string));
    // let metadataType = this.getTypeBySuffix(flags.name as string)
    // let component = Object.assign(metadataType, {path: "src-temp", recommended: "src-access-management"});
    // this.moveComponentToPackage(component , "src-access-management");



  }

  private async getExistingPackage(obj: Instruction) {
    let getExistingPackage = await inquirer.prompt([{
      type: "autocomplete",
      name: "package",
      message: "Search for package",
      source: this.searchExistingPackages,
      pageSize: 10
    }]);

    let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(null, getExistingPackage.package);
    obj.destination.push({package: packageDescriptor.path});
  }

  private async getNewpackage(obj: Instruction) {
    const getNewPackage = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Input name of the new package"
      },
      {
        type: "list",
        name: "anchor",
        message: `Select position of the new package`,
        loop: false,
        choices: ProjectConfig.getAllPackages(null),
        pageSize: 10
      },
      {
        type: "list",
        name: "position",
        message: "Position",
        choices: [{ name: "Before", value: "before" }, { name: "After", value: 'after' }]
      }
    ]);

    let indexOfNewPackage = ProjectConfig.getAllPackages(null).findIndex((packageName) => packageName === getNewPackage.anchor);
    if (getNewPackage.position === "after")
      indexOfNewPackage++;


    Pull.createNewPackage(null, getNewPackage.name, path.join("src", getNewPackage.name), indexOfNewPackage);

    fs.mkdirpSync(path.join("src", getNewPackage.name));

    obj.destination.push({package: path.join("src", getNewPackage.name)});
  }

  private async getMoveAction(obj: Instruction) {
    return await inquirer.prompt({
      type: "list",
      name: "moveAction",
      message: `Select a package for ${obj.type} ${obj.fullName}`,
      choices: this.getChoicesForMovingMetadata(obj),
    });
  }

  private async getPlusOneMoveAction(obj: Instruction) {
    let getMoveAction = await inquirer.prompt({
      type: "list",
      name: "moveAction",
      message: `Select additional package`,
      choices: [
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "New", value: MoveAction.NEW}
      ]
    });

    if (getMoveAction.moveAction === MoveAction.EXISTING) {
      await this.getExistingPackage(obj);
    } else if (getMoveAction.moveAction === MoveAction.NEW) {
      await this.getNewpackage(obj);
    } else {
      throw new Error(`Unrecognised MoveAction ${getMoveAction.moveAction}`);
    }
  }

  private async getSingleMoveAction(obj: Instruction, recommended: {package: string; aliasfy: boolean}[]) {
    const getPackage = await inquirer.prompt({
      type: "list",
      name: "package",
      message: "Select recommended package",
      choices: recommended.map((elem) => elem.package)
    });

    obj.destination.push(recommended.find((elem) => elem.package === getPackage.package));
  }

  /**
   *
   * @param projectDirectory
   * @param nameOfPackage
   * @param pathOfPackage
   * @param indexOfPackage
   */
   public static createNewPackage(
    projectDirectory: string,
    nameOfPackage: string,
    pathOfPackage: string,
    indexOfPackage: number
  ) {
    const packageConfig = ProjectConfig.getSFDXPackageManifest(projectDirectory);
    const newPackageDescriptor = {
      path: pathOfPackage,
      package: nameOfPackage,
      versionNumber: "1.0.0.0"
    };
    packageConfig.packageDirectories.splice(indexOfPackage, 0, newPackageDescriptor);

    let pathToProjectConfig: string;
    if (projectDirectory) {
      pathToProjectConfig = path.join(projectDirectory, "sfdx-project.json");
    } else {
      pathToProjectConfig = "sfdx-project.json";
    }
    fs.writeJSONSync(pathToProjectConfig, packageConfig, { spaces: 2 });
  }

  private getChoicesForMovingMetadata(metadata) {
    if (resource.types[metadata.type]?.strategy) {
      let recommendedPackages = resource.types[metadata.type].recommended?.map(elem => elem.package);
      return [
        { name: `Recommended (Strategy: ${resource.types[metadata.type].strategy}) ${recommendedPackages ? recommendedPackages : ""}`, value: MoveAction.RECOMMENDED },
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "New", value: MoveAction.NEW},
        { name: "Do nothing", value: MoveAction.NOTHING },
      ];
    } else {
      return [
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "New", value: MoveAction.NEW},
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
    let packages = ProjectConfig.getAllPackages(null);

    const defaultPackage = ProjectConfig.getDefaultSFDXPackageDescriptor(null).package;
    packages = packages.filter((packageName) => packageName !== defaultPackage);

    if (input) {
      return fuzzy.filter(input, packages).map((elem) => elem.string);
    } else return packages;
  }

  private getStatusResult(targetOrg: string, isForceOverwrite: boolean) {
    let statusResult;
    let resultJson = child_process.execSync(
      `sfdx force:source:status -u ${targetOrg} --json`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        maxBuffer: 1024*1024*5
      }
    );

    let result = JSON.parse(resultJson);

    const conflicts = result.result.filter((elem) => elem.state.endsWith("(Conflict)"));

    if (conflicts.length > 0 && !isForceOverwrite) {
      this.printStatus(conflicts);
      throw new Error("Source conflict(s) detected. Verify that you want to keep the remote versions, then run 'sfp pull -f' with the --forceoverwrite (-f) option");
    } else {
      statusResult = result.result.filter((elem) => !elem.state.endsWith("(Conflict)") && !elem.state.startsWith("Local"));
      this.printStatus(statusResult);
    }

    return statusResult;
  }

  private printStatus(statusResult) {
    const table = new Table({
      head: ["State", "Full Name", "Type", "File Path"]
    });

    statusResult.forEach((elem) => {
      table.push([elem.state, elem.fullName, elem.type, elem.filePath ? elem.filePath : "N/A"]);
    });

    console.log(table.toString());
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

enum Strategy {
  SINGLE = "single",
  DUPLICATE = "duplicate",
  PLUS_ONE = "plus-one",
  DELETE = "delete"
}

interface Component extends MetadataType {
  // path of component
  path: string;
  recommended: string;
}

interface Instruction {
  fullName: string,
  type: string,
  destination: {package: string; aliasfy?: boolean}[]
}