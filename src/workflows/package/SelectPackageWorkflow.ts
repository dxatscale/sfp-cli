import inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);

const fuzzy = require("fuzzy");

export default class SelectPackageWorkflow
{

  constructor(
    private readonly projectConfig
  ) {}

  /**
   * Supports fuzzy search
   * @returns descriptor of chosen package
   */
  public async pickAnExistingPackage() {
    let existingPackage = await inquirer.prompt([
      {
        type: "autocomplete",
        name: "name",
        message: "Search for package",
        source: (answers, input) => {
          let packages = this.getNameOfPackages();

          const defaultPackage =
            this.getDefaultSfdxPackageDescriptor().package;
          packages = packages.filter((packageName) => packageName !== defaultPackage);

          if (input) {
            return fuzzy.filter(input, packages).map((elem) => elem.string);
          } else return packages;
        },
        pageSize: 10
      },
    ]);

    return this.getSfdxPackageDescriptor(existingPackage.name);
  }

  /**
   * Choose one or more packages
   * @returns descriptor of one or more chosen packages
   */
  public async choosePackages() {
    const chosenPackages = await inquirer.prompt([
      {
        type: "checkbox",
        name: "packages",
        message: "Select packages",
        choices: this.getPackageDirectoriesAsChoices(),
        loop: false
      }
    ]);

    return chosenPackages.packages;
  }

  private getPackageDirectoriesAsChoices() {
    return this.projectConfig.packageDirectories.map(elem => {
      return {
        name: elem.package,
        value: elem
      }
    });
  }

  private getDefaultSfdxPackageDescriptor() {
    return this.projectConfig.packageDirectories.find((pkg) => pkg.default);
  }

  private getSfdxPackageDescriptor(packageName: string) {
    return this.projectConfig.packageDirectories.find((pkg) => pkg.package === packageName);
  }

  private getNameOfPackages(): string[] {
    let nameOfPackages: string[] = [];
    this.projectConfig.packageDirectories.forEach((pkg) => {
     nameOfPackages.push(pkg["package"]);
    });
    return nameOfPackages;
  }
}