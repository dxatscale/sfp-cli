import {flags} from '@oclif/command'
import {ComponentSet, MetadataConverter} from '@salesforce/source-deploy-retrieve';
import path = require('path');
import * as fs from "fs-extra";
import child_process = require("child_process");
import inquirer = require("inquirer");
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import * as metadataRegistry from "../metadataRegistry.json";
const Table = require("cli-table");
import SFPlogger, {
  COLOR_HEADER,
  LoggerLevel
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PromptToPickAnOrg from "../prompts/PromptToPickAnOrg";
import PackagePrompt from "../prompts/PackagePrompt";
import simpleGit, { SimpleGit } from "simple-git";
import SfpCommand from '../SfpCommand';


export default class Pull extends SfpCommand {
  static description = 'pull source from scratch org/sandbox to the project. Provides interactive interface for packaging new metadata.'

  static examples = [`$ sfp pull -u <scratchorg>`];

  static flags = {
    help: flags.help({ char: "h" }),
  };

  static args = [{ name: "caller" }];
  // private readonly registry: MetadataRegistry = defaultRegistry;

  static hidden = true;

  async run() {

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
    let devOrgUserName = await new PromptToPickAnOrg({alias:aliasName}).promptForDevOrgSelection();


    const statusResult = await this.getStatusResult(
      devOrgUserName
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

    const projectConfig = ProjectConfig.getSFDXPackageManifest(null);
    const newPackagesDirectories: string[] = [];

    let mergePlan: Instruction[] = [];
    for (let remoteAddition of remoteAdditions) {
      console.log();
      const instruction: Instruction = {
        fullName: remoteAddition.fullName,
        type: remoteAddition.type,
        destination: [],
      };

      let moveAction = await this.getMoveAction(instruction);

      if (moveAction === MoveAction.RECOMMENDED) {
        if (metadataRegistry.types[instruction.type].strategy === Strategy.PLUS_ONE) {
          instruction.destination.push(...metadataRegistry.types[instruction.type].recommended);

          const plusOneMoveAction = await this.getPlusOneMoveAction();
          if (plusOneMoveAction === MoveAction.EXISTING) {
            let existingPackage = await new PackagePrompt(projectConfig).promptForExistingPackage();
            instruction.destination.push({package: existingPackage.path});

          } else if (plusOneMoveAction === MoveAction.NEW) {
            const newPackage = await new PackagePrompt(projectConfig).promptForNewPackage();
            this.addNewPackageToProjectConfig(newPackage.descriptor, newPackage.indexOfPackage, projectConfig);
            newPackagesDirectories.push(newPackage.descriptor.path);
            instruction.destination.push({ package: newPackage.descriptor.path });

          } else {
            throw new Error(`Unrecognised MoveAction ${moveAction}`);
          }

        } else if (metadataRegistry.types[instruction.type].strategy === Strategy.DUPLICATE) {
          instruction.destination.push(...metadataRegistry.types[instruction.type].recommended);

        } else if (metadataRegistry.types[instruction.type].strategy === Strategy.SINGLE) {
          const singleRecommendedPackage = await this.getSingleRecommendedPackage(
            metadataRegistry.types[instruction.type].recommended
          );
          instruction.destination.push(
            metadataRegistry.types[instruction.type].recommended.find((elem) => elem.package === singleRecommendedPackage)
          );

        } else if (metadataRegistry.types[instruction.type].strategy === Strategy.DELETE) {
          // do nothing
        } else {
          throw new Error("Strategy not defined or unknown");
        }

      } else if (moveAction === MoveAction.NEW) {
        const newPackage = await new PackagePrompt(projectConfig).promptForNewPackage();
        this.addNewPackageToProjectConfig(newPackage.descriptor, newPackage.indexOfPackage, projectConfig);
        newPackagesDirectories.push(newPackage.descriptor.path);
        instruction.destination.push({ package: newPackage.descriptor.path });

      } else if (moveAction === MoveAction.EXISTING) {
        let existingPackage = await new PackagePrompt(projectConfig).promptForExistingPackage();
        instruction.destination.push({package: existingPackage.path});

      } else if (moveAction === MoveAction.NOTHING) {
        continue;

      } else {
        throw new Error(`Unrecognised MoveAction ${moveAction}`);
      }
      mergePlan.push(instruction);
    }

    newPackagesDirectories.forEach((dir) => fs.mkdirpSync(dir));
    this.writeProjectConfigToFile(projectConfig);

    console.log("\nPulling source components...");
    let pullResult = JSON.parse(
      child_process.execSync(
        `sfdx force:source:pull -u ${devOrgUserName} -f --json`,
        {
          encoding: "utf8",
          stdio: "pipe",
          maxBuffer: 1024 * 1024 * 5,
        }
      )
    ).result;
    console.log("Successfully pulled source components");

    console.log("\nMoving source components...");

    for (let instruction of mergePlan) {
      let components = pullResult.pulledSource.filter(
        (component) =>
          component.fullName === instruction.fullName && component.type === instruction.type
      );

      const converter = new MetadataConverter();
      const componentSet = ComponentSet.fromSource(
        components.find(
          (component) => path.extname(component.filePath) === ".xml"
        ).filePath
      );

      for (let dest of instruction.destination) {
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



  private async getMoveAction(instruction: Instruction) {
    let moveAction = await inquirer.prompt({
      type: "list",
      name: "action",
      message: `Select a package for ${instruction.type} ${instruction.fullName}`,
      choices: this.getChoicesForMovingMetadata(instruction),
    });
    return moveAction.action;
  }

  private getChoicesForMovingMetadata(metadata) {
    if (metadataRegistry.types[metadata.type]?.strategy) {
      let recommendedPackages = metadataRegistry.types[metadata.type].recommended?.map(
        (elem) => elem.package
      );
      return [
        {
          name: `Recommended (Strategy: ${
            metadataRegistry.types[metadata.type].strategy
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

  private async getPlusOneMoveAction() {
    let plusOneMoveAction = await inquirer.prompt({
      type: "list",
      name: "action",
      message: `Select additional package`,
      choices: [
        { name: "Existing", value: MoveAction.EXISTING },
        { name: "New", value: MoveAction.NEW },
      ],
    });

    return plusOneMoveAction.action;
  }

  private async getSingleRecommendedPackage(
    recommended: { package: string; aliasfy: boolean }[]
  ) {
    let singleRecommendedPackage = await inquirer.prompt({
      type: "list",
      name: "package",
      message: "Select recommended package",
      choices: recommended.map((elem) => elem.package),
    });

    return singleRecommendedPackage.package;
  }


  private addNewPackageToProjectConfig(
    packageDescriptor,
    indexOfPackage: number,
    projectConfig
  ) {
    projectConfig.packageDirectories.forEach((dir) => {
      if (dir.package === packageDescriptor.package)
        throw new Error(`Package with name ${packageDescriptor.package} already exists`);
    });

    projectConfig.packageDirectories.splice(
      indexOfPackage,
      0,
      packageDescriptor
    );
  }


  private async getStatusResult(targetOrg: string) {
    let statusResult;
    let resultJson = child_process.execSync(
      `sfdx force:source:status -u ${targetOrg} --json`,
      {
        encoding: "utf8",
        stdio: "pipe",
        maxBuffer: 1024 * 1024 * 5
      }
    );

    let result = JSON.parse(resultJson);

    const conflicts = result.result.filter((elem) =>
      elem.state.endsWith("(Conflict)")
    );

    if (conflicts.length > 0) {
      await this.conflictsHandler(conflicts);
    }

    statusResult = result.result.filter(
      (elem) =>
        !elem.state.startsWith("Local")
    ).map((elem) => {
      elem.state = elem.state.replace(/\(Conflict\)$/, "");
      return elem;
    })

    this.printStatus(statusResult);


    return statusResult;
  }

  private async conflictsHandler(conflicts: any) {
    this.printStatus(conflicts);
    SFPlogger.log("Source conflict(s) detected. Verify that you want to keep the remote versions", LoggerLevel.WARN);
    const getConfirmationForOverwrite = await inquirer.prompt([
      {
        type: "input",
        name: "overwrite",
        message: "To forcibly overwrite local changes, type force"
      }
    ]);

    if (getConfirmationForOverwrite.overwrite !== "force") {
      throw new Error(
        "Source conflict(s) detected. Abandoning..."
      );
    }
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

  private writeProjectConfigToFile(projectConfig: any) {
    fs.writeJSONSync("sfdx-project.json", projectConfig, { spaces: 2 });
  }
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

interface Instruction {
  fullName: string;
  type: string;
  destination: { package: string; aliasfy?: boolean }[];
}
