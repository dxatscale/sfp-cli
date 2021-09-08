import inquirer = require("inquirer");
const fuzzy = require("fuzzy");
const path = require("path");

export default class PackagePrompt {

  constructor(
    private readonly projectConfig
  ) {}

  public async promptForNewPackage() {
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
        type: "input",
        name: "version",
        message: "Version of the package e.g. 1.0.0.0",
        default: "1.0.0.0",
        validate: (input, answers) => {
          let match = input.match(/^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.NEXT)?$/);
          if (!match) {
            return `Version must be in the format 1.0.0.0 or 1.0.0.NEXT`;
          } else return true;
        }
      }
    ]);

    let indexOfNewPackage = nameOfExistingPackages.findIndex(
      (packageName) => packageName === newPackage.anchor
    );
    if (newPackage.position === "after") indexOfNewPackage++;

    return {
      descriptor: {
        path: path.join("src", newPackage.name),
        package: newPackage.name,
        versionNumber: newPackage.version
      },
      indexOfPackage: indexOfNewPackage
    };
  }

  public async promptForExistingPackage() {
    let existingPackage = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "name",
        message: "Search for package",
        source: this.searchExistingPackages,
        pageSize: 10,
      },
    ]);

    return this.getSfdxPackageDescriptor(existingPackage.name);
  }

  /**
   * Fuzzy search for existing packages in the sfdx-project.json
   * @param answers
   * @param input
   * @returns
   */
   private searchExistingPackages(answers, input) {
    let packages = this.getNameOfPackages();

    const defaultPackage =
      this.getDefaultSfdxPackageDescriptor().package;
    packages = packages.filter((packageName) => packageName !== defaultPackage);

    if (input) {
      return fuzzy.filter(input, packages).map((elem) => elem.string);
    } else return packages;
  }

  private getNameOfPackages(): string[] {
    let nameOfPackages: string[] = [];
    this.projectConfig.packageDirectories.forEach((pkg) => {
     nameOfPackages.push(pkg["package"]);
    });
    return nameOfPackages;
  }

  public getDefaultSfdxPackageDescriptor() {
    return this.projectConfig.packageDirectories.find((pkg) => pkg.default);
  }

   public getSfdxPackageDescriptor(packageName: string) {
    return this.projectConfig.packageDirectories.find((pkg) => pkg.package === packageName);
  }
}