import { string } from "@oclif/parser/lib/flags";
import inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);


const path = require("path");

export default class CreatePackageWorkflow {

  constructor(
    private readonly projectConfig
  ) {}

  public async createNewPackage():Promise<SFDXPackage> {
    const nameOfExistingPackages = this.getNameOfPackages();

    const newPackage = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Input name of the new package",
        validate: (input, answers) => {
          if (
            nameOfExistingPackages.find(
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
        choices: nameOfExistingPackages,
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
      {
        type: "list",
        name: "packageType",
        message: "Type of the package",
        choices: [
          { name: "Unlocked", value: "unlocked" },
          { name: "Org-Dependent-Unlocked", value: "org-unlocked" },
          { name: "Source Package", value: "source" },
          { name: "Data Package", value: "data" },
        ],
      },
      {
        type: "input",
        name: "version",
        message: "Version of the package e.g. 1.0.0",
        default: "1.0.0",
        validate: (input, answers) => {
          let match = input.match(/^[0-9]+\.[0-9]+\.[0-9]+\$/);
          if (!match) {
            return `Version must be in the format X.Y.Z e.g: 1.0.0`;
          } else return true;
        }
      },
      {
        type: "input",
        name: "description",
        message: "Please enter a description for this package",
        validate: (input, answers) => {
          if (!input) return "Package Descriptions cannot be empty. Press <enter> to retry";
          else return true;
        }
      },

    ]);

    let indexOfNewPackage = nameOfExistingPackages.findIndex(
      (packageName) => packageName === newPackage.anchor
    );
    if (newPackage.position === "after") indexOfNewPackage++;

    return {
      descriptor: {
        path: path.join("src", newPackage.name),
        package: newPackage.name,
        versionNumber: (newPackage.type==='unlocked' || newPackage.type==='org-unlocked')?newPackage.version+".NEXT":newPackage.version+".0"
      },
      type: newPackage.type,
      description:newPackage.description,
      indexOfPackage: indexOfNewPackage
    };
  }



  private getNameOfPackages(): string[] {
    let nameOfPackages: string[] = [];
    this.projectConfig.packageDirectories.forEach((pkg) => {
     nameOfPackages.push(pkg["package"]);
    });
    return nameOfPackages;
  }


}

export interface SFDXPackage
{
    descriptor: {
      path: string,
      package: string,
      versionNumber: string,
    },
    type: string,
    description:string,
    indexOfPackage: number

}