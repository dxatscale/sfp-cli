import inquirer = require("inquirer");
const fuzzy = require("fuzzy");

export default class SelectPackageWorkflow
{

  constructor(
    private readonly projectConfig
  ) {}

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