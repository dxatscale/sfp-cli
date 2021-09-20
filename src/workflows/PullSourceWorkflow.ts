import {
  ComponentSet,
  MetadataConverter,
  ConvertResult
} from "@salesforce/source-deploy-retrieve";
import path = require("path");
import * as fs from "fs-extra";
import inquirer = require("inquirer");
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import * as metadataRegistry from "../metadataRegistry.json";

import SFPLogger, {
  COLOR_KEY_MESSAGE,
  COLOR_KEY_VALUE,
  COLOR_SUCCESS,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

import CreatePackageWorkflow from "./CreatePackageWorkflow";
import SourcePull from "../impl/sfdxwrappers/SourcePull";
import SelectPackageWorkflow from "./SelectPackageWorkflow";
import { isEmpty } from "lodash";
import cli from "cli-ux";

export default class PulSourceWorkflow {



  public constructor(private devOrg:string,private statusResult: any)
  {

  }

  async execute():Promise<void> {

    if (this.statusResult.length === 0) {
      SFPLogger.log(COLOR_SUCCESS("  No changes found"));
      return;
    }

    const remoteAdditions = this.statusResult.filter(
      (elem) => elem.state === "Remote Add"
    );

    SFPLogger.log(
      COLOR_KEY_MESSAGE(
        `  Found ${remoteAdditions.length} new metadata components, which require a new home`
      )
    );

    const projectConfig = ProjectConfig.getSFDXPackageManifest(null);
    const newPackagesDirectories: string[] = [];

    let mergePlan: Instruction[] = [];
    for (let remoteAddition of remoteAdditions) {

      const instruction: Instruction = {
        fullName: remoteAddition.fullName,
        type: remoteAddition.type,
        destination: [],
      };

      let moveAction = await this.getMoveAction(instruction);

      if (moveAction === MoveAction.RECOMMENDED) {
        if (
          metadataRegistry.types[instruction.type].strategy ===
          Strategy.PLUS_ONE
        ) {
          instruction.destination.push(
            ...metadataRegistry.types[instruction.type].recommended
          );

          const plusOneMoveAction = await this.getPlusOneMoveAction();
          if (plusOneMoveAction === MoveAction.EXISTING) {
            let existingPackage = await new SelectPackageWorkflow(
              projectConfig
            ).pickAnExistingPackage();
            instruction.destination.push({ package: existingPackage.path });
          } else if (plusOneMoveAction === MoveAction.NEW) {
            const newPackage = await new CreatePackageWorkflow(
              projectConfig
            ).createNewPackage();
            this.addNewPackageToProjectConfig(
              newPackage.descriptor,
              newPackage.indexOfPackage,
              projectConfig
            );
            newPackagesDirectories.push(newPackage.descriptor.path);
            instruction.destination.push({
              package: newPackage.descriptor.path,
            });
          } else {
            throw new Error(`Unrecognised MoveAction ${moveAction}`);
          }
        } else if (
          metadataRegistry.types[instruction.type].strategy ===
          Strategy.DUPLICATE
        ) {
          instruction.destination.push(
            ...metadataRegistry.types[instruction.type].recommended
          );
        } else if (
          metadataRegistry.types[instruction.type].strategy === Strategy.SINGLE
        ) {
          const singleRecommendedPackage =
            await this.getSingleRecommendedPackage(
              metadataRegistry.types[instruction.type].recommended
            );
          instruction.destination.push(
            metadataRegistry.types[instruction.type].recommended.find(
              (elem) => elem.package === singleRecommendedPackage
            )
          );
        } else if (
          metadataRegistry.types[instruction.type].strategy === Strategy.DELETE
        ) {
          // do nothing
        } else {
          throw new Error("Strategy not defined or unknown");
        }
      } else if (moveAction === MoveAction.NEW) {
        const newPackage = await new CreatePackageWorkflow(
          projectConfig
        ).createNewPackage();
        this.addNewPackageToProjectConfig(
          newPackage.descriptor,
          newPackage.indexOfPackage,
          projectConfig
        );
        newPackagesDirectories.push(newPackage.descriptor.path);
        instruction.destination.push({ package: newPackage.descriptor.path });
      } else if (moveAction === MoveAction.EXISTING) {
        let existingPackage = await new SelectPackageWorkflow(
          projectConfig
        ).pickAnExistingPackage();
        instruction.destination.push({ package: existingPackage.path });
      } else if (moveAction === MoveAction.NOTHING) {
        continue;
      } else {
        throw new Error(`Unrecognised MoveAction ${moveAction}`);
      }
      mergePlan.push(instruction);
    }

    newPackagesDirectories.forEach((dir) => fs.mkdirpSync(dir));
    this.writeProjectConfigToFile(projectConfig);

    cli.action.start(`  Pulling source components from dev org... ${COLOR_KEY_VALUE(this.devOrg)}..`);
    let pullResult = await (new SourcePull(this.devOrg, true)).exec(true);
    cli.action.stop();
    SFPLogger.log(COLOR_SUCCESS("  Successfully pulled source components"));

    cli.action.start("  Moving source components...");

    for (let instruction of mergePlan) {
      let components = pullResult.pulledSource.filter(
        (component) =>
          component.fullName === this.encodeData(instruction.fullName) &&
          component.type === instruction.type
      );

      if(isEmpty(components))
       continue;

      const converter = new MetadataConverter();
      const componentSet = ComponentSet.fromSource(
        components.find(
          (component) => path.extname(component.filePath) === ".xml"
        )?.filePath
      );


      for (let dest of instruction.destination) {
        let convertResult: ConvertResult;

        if (dest.aliasfy) {
          let files = fs.readdirSync(dest.package);
          let aliases = files.filter((file) => {
            let filepath = path.join(dest.package, file);
            return fs.lstatSync(filepath).isDirectory();
          });

          for (let alias of aliases) {
            convertResult = await converter.convert(componentSet, "source", {
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
          convertResult = await converter.convert(componentSet, "source", {
            type: "merge",
            mergeWith: ComponentSet.fromSource(
              path.resolve(dest.package)
            ).getSourceComponents(),
            defaultDirectory: dest.package,
            forceIgnoredPaths:
              componentSet.forceIgnoredPaths ?? new Set<string>(),
          });
        }

        if (this.isXmlFileSuffixDuped(convertResult.converted[0].xml)) {
          this.dedupeXmlFileSuffix(convertResult.converted[0].xml);
        }
      }

      for (let component of components) {
        fs.unlinkSync(component.filePath);
      }
    }

    cli.action.stop();
  }

  private isXmlFileSuffixDuped(xmlFile: string): boolean {
    return xmlFile.match(/-meta\.xml/g)?.length === 2
  }

  private dedupeXmlFileSuffix(xmlFile: string): void {
      let deduped = xmlFile.replace(/-meta\.xml/, "");
      fs.renameSync(xmlFile, deduped);
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
      let recommendedPackages = metadataRegistry.types[
        metadata.type
      ].recommended?.map((elem) => elem.package);
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
        throw new Error(
          `Package with name ${packageDescriptor.package} already exists`
        );
    });

    projectConfig.packageDirectories.splice(
      indexOfPackage,
      0,
      packageDescriptor
    );
  }







  private writeProjectConfigToFile(projectConfig: any) {
    fs.writeJSONSync("sfdx-project.json", projectConfig, { spaces: 2 });
  }

  private encodeData(s:String):String{
    return s.replace(/\(/g, "%28").replace(/\)/g, "%29");
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
