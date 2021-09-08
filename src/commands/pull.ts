import { Command, flags } from "@oclif/command";
import {
  ComponentSet,
  MetadataConverter,
} from "@salesforce/source-deploy-retrieve";
import path = require("path");
import * as fs from "fs-extra";
import child_process = require("child_process");
import inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
const fuzzy = require("fuzzy");
import * as resource from "../resource.json";
const Table = require("cli-table");
import SFPlogger, {
  COLOR_HEADER,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PromptToPickAnOrg from "../prompts/PromptToPickAnOrg";
import simpleGit, { SimpleGit } from "simple-git";

export default class Pull extends Command {
  static description =
    "pull source from scratch org/sandbox to the project. Provides interactive interface for packaging new metadata.";

  static examples = [`$ sfp pull -u <scratchorg>`];

  static flags = {
    help: flags.help({ char: "h" }),
  };

  static args = [{ name: "caller" }];
  // private readonly registry: MetadataRegistry = defaultRegistry;

  static hidden = true;

  async run() {
    const { args, flags } = this.parse(Pull);

    if (args.caller !== "inner") {
      SFPlogger.log(
        COLOR_HEADER(
          `sfp cli -- The DX@Scale Dev CLI -- ${this.config.version}`
        )
      );
    }



    // TODO: Move to property requiresProject: boolean
    if (!fs.existsSync("sfdx-project.json"))
      throw new Error(
        "This command must be run in the root directory of a SFDX project"
      );


    //Intitialize Git
    const git: SimpleGit = simpleGit();
    let currentBranch = (await git.branch()).current;
    let aliasName = currentBranch.split(/[/]+/).pop();



    //Prompt to Pick a scratch Org
    let scratchOrgUserName = await new PromptToPickAnOrg({alias:aliasName}).promptForScratchOrgSelection();


    const statusResult = this.getStatusResult(
      scratchOrgUserName,
      false
    );

    if (statusResult.length === 0) {
      console.log("No changes found");
      return;
    }

    const remoteAdditions = statusResult.filter(
      (elem) => elem.state === "Remote Add"
    );

    console.log(
      `Found ${remoteAdditions.length} new metadata components, which require a new home`
    );
    const defaultPackage = ProjectConfig.getDefaultSFDXPackageDescriptor(null);

    let result = [];
    for (let remoteAddition of remoteAdditions) {
      console.log();
      const obj: Instruction = {
        fullName: remoteAddition.fullName,
        type: remoteAddition.type,
        destination: [],
      };

      let getMoveAction = await this.getMoveAction(obj);

      if (getMoveAction.moveAction === MoveAction.RECOMMENDED) {
        if (resource.types[obj.type].strategy === Strategy.PLUS_ONE) {
          obj.destination.push(...resource.types[obj.type].recommended);
          await this.getPlusOneMoveAction(obj);
        } else if (resource.types[obj.type].strategy === Strategy.DUPLICATE) {
          obj.destination.push(...resource.types[obj.type].recommended);
        } else if (resource.types[obj.type].strategy === Strategy.SINGLE) {
          await this.getSingleMoveAction(
            obj,
            resource.types[obj.type].recommended
          );
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

    console.log();
    console.log("Pulling source components...");
    let pullResult = JSON.parse(
      child_process.execSync(
        `sfdx force:source:pull -u ${scratchOrgUserName} -f --json`,
        {
          encoding: "utf8",
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 5,
        }
      )
    ).result;

    console.log();
    console.log("Successfully pulled source components");

    console.log();
    console.log("Moving source components...");

    for (let elem of result) {
      let components = pullResult.pulledSource.filter(
        (component) =>
          component.fullName === elem.fullName && component.type === elem.type
      );

      const converter = new MetadataConverter();
      const componentSet = ComponentSet.fromSource(
        components.find(
          (component) => path.extname(component.filePath) === ".xml"
        ).filePath
      );

      for (let dest of elem.destination) {
        if (dest.aliasfy) {
          let files = fs.readdirSync(dest.package);
          let aliases = files.filter((file) => {
            let filepath = path.join(dest.package, file);
            return fs.lstatSync(filepath).isDirectory();
          });

          for (let alias of aliases) {
            await converter.convert(componentSet, "source", {
              type: "merge",
              mergeWith: ComponentSet.fromSource(
                path.resolve(dest.package, alias)
              ).getSourceComponents(),
              defaultDirectory: path.join(dest.package, alias),
              forceIgnoredPaths:
                componentSet.forceIgnoredPaths ?? new Set<string>(),
            });
          }
        } else {
          await converter.convert(componentSet, "source", {
            type: "merge",
            mergeWith: ComponentSet.fromSource(
              path.resolve(dest.package)
            ).getSourceComponents(),
            defaultDirectory: dest.package,
            forceIgnoredPaths:
              componentSet.forceIgnoredPaths ?? new Set<string>(),
          });
        }
      }

      for (let component of components) {
        fs.unlinkSync(component.filePath);
      }
    }

    console.log("Successfully moved source components");
  }

  private async getExistingPackage(obj: Instruction) {
    let getExistingPackage = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "package",
        message: "Search for package",
        source: this.searchExistingPackages,
        pageSize: 10,
      },
    ]);

    let packageDescriptor = ProjectConfig.getSFDXPackageDescriptor(
      null,
      getExistingPackage.package
    );
    obj.destination.push({ package: packageDescriptor.path });
  }

  private async getNewpackage(obj: Instruction) {
    const getNewPackage = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Input name of the new package",
        validate: (input, answers) => {
          if (
            ProjectConfig.getAllPackages(null).find(
              (packageName) => packageName === input
            )
          ) {
            return `Package with name ${input} already exists`;
          } else return true;
        },
      },
      {
        type: "list",
        name: "anchor",
        message: `Select position of the new package`,
        loop: false,
        choices: ProjectConfig.getAllPackages(null),
        pageSize: 10,
      },
      {
        type: "list",
        name: "position",
        message: "Position",
        choices: [
          { name: "Before", value: "before" },
          { name: "After", value: "after" },
        ],
      },
    ]);

    let indexOfNewPackage = ProjectConfig.getAllPackages(null).findIndex(
      (packageName) => packageName === getNewPackage.anchor
    );
    if (getNewPackage.position === "after") indexOfNewPackage++;

    Pull.createNewPackage(
      null,
      getNewPackage.name,
      path.join("src", getNewPackage.name),
      indexOfNewPackage
    );

    fs.mkdirpSync(path.join("src", getNewPackage.name));

    obj.destination.push({ package: path.join("src", getNewPackage.name) });
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
        { name: "New", value: MoveAction.NEW },
      ],
    });

    if (getMoveAction.moveAction === MoveAction.EXISTING) {
      await this.getExistingPackage(obj);
    } else if (getMoveAction.moveAction === MoveAction.NEW) {
      await this.getNewpackage(obj);
    } else {
      throw new Error(`Unrecognised MoveAction ${getMoveAction.moveAction}`);
    }
  }

  private async getSingleMoveAction(
    obj: Instruction,
    recommended: { package: string; aliasfy: boolean }[]
  ) {
    const getPackage = await inquirer.prompt({
      type: "list",
      name: "package",
      message: "Select recommended package",
      choices: recommended.map((elem) => elem.package),
    });

    obj.destination.push(
      recommended.find((elem) => elem.package === getPackage.package)
    );
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
    const packageConfig =
      ProjectConfig.getSFDXPackageManifest(projectDirectory);
    packageConfig.packageDirectories.forEach((dir) => {
      if (dir.package === nameOfPackage)
        throw new Error(`Package with name ${nameOfPackage} already exists`);
    });
    const newPackageDescriptor = {
      path: pathOfPackage,
      package: nameOfPackage,
      versionNumber: "1.0.0.0",
    };
    packageConfig.packageDirectories.splice(
      indexOfPackage,
      0,
      newPackageDescriptor
    );

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
      let recommendedPackages = resource.types[metadata.type].recommended?.map(
        (elem) => elem.package
      );
      return [
        {
          name: `Recommended (Strategy: ${
            resource.types[metadata.type].strategy
          }) ${recommendedPackages ? recommendedPackages : ""}`,
          value: MoveAction.RECOMMENDED,
        },
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "New", value: MoveAction.NEW },
        { name: "Do nothing", value: MoveAction.NOTHING },
      ];
    } else {
      return [
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "New", value: MoveAction.NEW },
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

    const defaultPackage =
      ProjectConfig.getDefaultSFDXPackageDescriptor(null).package;
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
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 1024 * 1024 * 5,
      }
    );

    let result = JSON.parse(resultJson);

    const conflicts = result.result.filter((elem) =>
      elem.state.endsWith("(Conflict)")
    );

    if (conflicts.length > 0 && !isForceOverwrite) {
      this.printStatus(conflicts);
      throw new Error(
        "Source conflict(s) detected. Verify that you want to keep the remote versions, then run 'sfp pull -f' with the --forceoverwrite (-f) option"
      );
    } else {
      statusResult = result.result.filter(
        (elem) =>
          !elem.state.endsWith("(Conflict)") && !elem.state.startsWith("Local")
      );
      this.printStatus(statusResult);
    }

    return statusResult;
  }

  private printStatus(statusResult) {
    const table = new Table({
      head: ["State", "Full Name", "Type", "File Path"],
    });

    statusResult.forEach((elem) => {
      table.push([
        elem.state,
        elem.fullName,
        elem.type,
        elem.filePath ? elem.filePath : "N/A",
      ]);
    });

    console.log(table.toString());
  }

  // /**
  //  * Implement own method, as @salesforce/source-deploy-retrieve getTypeBySuffix does not walk through children
  //  * @param suffix
  //  */
  // private getTypeBySuffix(suffix: string): MetadataType {
  //   let metadataType: MetadataType;

  //   outer:
  //   for (let type in this.registry.types) {

  //     if (this.registry.types[type].suffix === suffix) {
  //       metadataType = this.registry.types[type];
  //       break;
  //     } else if (this.registry.types[type].children) {
  //       let typesOfChildren = this.registry.types[type].children?.types;
  //       for (let type in typesOfChildren) {
  //         if (typesOfChildren[type].suffix === suffix) {
  //           metadataType = typesOfChildren[type];
  //           break outer;
  //         }
  //       }
  //     }
  //   }

  //   return metadataType;
  // }

  // private getMetadataSuffix(file: string): string {
  //   let metadataSuffix: string;

  //   const filename = path.basename(file);
  //   const match = filename.match(/\.(?<suffix>.+)-meta.xml$/i);
  //   if (match?.groups?.suffix) {
  //     metadataSuffix = match.groups.suffix;
  //   } else {
  //     metadataSuffix = "";
  //   }

  //   return metadataSuffix;
  // }

  // private moveComponentToPackage(component: Component, packageDir: string) {
  //   let directoryname: string;
  //   if (component.folderType) {
  //     let folderName = path.basename(path.dirname(component.path));
  //     directoryname = path.join(component.directoryName, folderName);
  //   } else directoryname = component.directoryName;

  //   // check whether component directory exists
  //   let directory = glob.sync(`${directoryname}/`, {
  //     cwd: packageDir,
  //     absolute: true
  //   });

  //   let filename = path.basename(component.path);
  //   if (directory.length === 1) {
  //     fs.moveSync(component.path, path.join(directory, filename), {overwrite: false});
  //   } else {
  //     let directory = path.join(packageDir, "main", "default", directoryname);
  //     fs.mkdirpSync(directory);
  //     fs.moveSync(component.path, path.join(directory, filename), {overwrite: false})
  //   }
  //   // const packageDirContents = FileSystem.readdirRecursive(packageDir);
  //   // // packageDirContents.forEach((elem) => )

  //   // // if (component.)
  // }
}

enum MoveAction {
  RECOMMENDED = "recommended",
  NEW = "new",
  EXISTING = "existing",
  NOTHING = "nothing",
}

enum Strategy {
  SINGLE = "single",
  DUPLICATE = "duplicate",
  PLUS_ONE = "plus-one",
  DELETE = "delete",
}

// interface Component extends MetadataType {
//   // path of component
//   path: string;
//   recommended: string;
// }

interface Instruction {
  fullName: string;
  type: string;
  destination: { package: string; aliasfy?: boolean }[];
}
