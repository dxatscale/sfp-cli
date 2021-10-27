import { flags } from "@oclif/command";
import { Messages } from "@salesforce/core";
import SfpCommand from "../SfpCommand";
import inquirer = require("inquirer");
import * as fs from "fs-extra";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import PackageVersion, {Positional} from "../impl/package/PackageVersion";
import lodash = require("lodash");

// Initialize Messages with the current plugin directory
// Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
// const messages = Messages.loadMessages('@dxatscale/sfpowerscripts', 'manage_versions');

export default class Manage extends SfpCommand {

  public static description = "Manage package versions";

  public static examples = [
    `sfp manage -a`,
    `sfp manage -p package-name -b -v major -n -d`,
    `sfp manage -allpackages --resetbuildnumber`,
    `sfp manage -p package-name`
  ];

  static args = [{name: 'positional'}]

  static flags = {
    help: flags.help({ char: "h" }),
  };

  public async exec() {
    const projectConfig = ProjectConfig.getSFDXPackageManifest(null);
    const oldProjectConfig = lodash.cloneDeep(projectConfig); // for comparison and printing of changes

    if (this.args.positional) {
      if (this.isValidPositional(this.args.positional)) {
        for (const packageDescriptor of projectConfig.packageDirectories) {
          const newPackageVersion = new PackageVersion(
            packageDescriptor.versionNumber
          ).increment(this.args.positional);


          packageDescriptor.versionNumber = newPackageVersion;

          // update dependencies
          Manage.updateDependentsOfPackage(packageDescriptor, projectConfig);
        }
      } else {
        throw new Error("Positional should be one of 'major', 'minor' or 'patch'");
      }
    } else {
      for (const packageDescriptor of projectConfig.packageDirectories) {
        const newPackageVersion = await this.getNewPackageVersion(packageDescriptor);

        packageDescriptor.versionNumber = newPackageVersion;

        // update dependencies
        Manage.updateDependentsOfPackage(packageDescriptor, projectConfig);
      }
    }

    this.printChanges(oldProjectConfig, projectConfig);

    fs.writeJSONSync('sfdx-project.json', projectConfig, {encoding: 'UTF-8', spaces: 4});
  }

    /**
   * Get all packages which are dependent on the given package
   * @param sfdxPackage name of parent package
   * @param projectConfig
   * @returns an array of dependent packages
   */
     public static getDependentsOfPackage(sfdxPackage: string, projectConfig){
      const dependentPackages = [];
      projectConfig.packageDirectories.forEach(pkgDir => {
        if (pkgDir.package !== sfdxPackage) {
          if (pkgDir.dependencies) {
            const pattern = new RegExp(`^${sfdxPackage}@[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.LATEST)?$`);
            pkgDir.dependencies.forEach(dependency => {
              if (dependency.package === sfdxPackage || pattern.test(dependency.package)){
                dependentPackages.push(pkgDir);
              }
            });
          }
        }
      });
      return dependentPackages;
    }



    /**
     * Function to update a dependent of a package
     * @param package
     * @param dependents
     * @returns
     */
    public static updateDependentsOfPackage(pkg, projectConfig){
      const packageVersion = new PackageVersion(pkg.versionNumber);
      if (packageVersion.buildNum === "NEXT") {
        // build number for dependents is LATEST, where the parent has build number NEXT
        packageVersion.buildNum = 'LATEST';
      }

      const dependentPackages = this.getDependentsOfPackage(pkg.package, projectConfig);

      const pattern = new RegExp(`^${pkg.package}@[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.LATEST)?$`);
      dependentPackages.forEach(dependentPackage => {
        for (const dependency of dependentPackage.dependencies) {
          if(dependency.package === pkg.package){
            dependency.versionNumber = packageVersion.getVersionNumber();
            break;
          } else if (pattern.test(dependency.package)) {
            dependency.package = `${pkg.package}@${packageVersion.getVersionNumber()}}`
            break;
          }
        }
      });
    }

  private printChanges(oldProjectConfig: any, projectConfig: any) {
    console.log("Changes:");
    for (let i = 0; i < oldProjectConfig.packageDirectories.length; i++) {
      console.log(
        " - ",
        oldProjectConfig.packageDirectories[i].package,
        oldProjectConfig.packageDirectories[i].versionNumber,
        " => ",
        projectConfig.packageDirectories[i].versionNumber
      );
    }
  }

  /**
   * Prompt using inquirier for the version of the given package to update
   * @param pkg
   * @returns
   */
   private async getNewPackageVersion(packageDescriptor): Promise<string> {
    const currentVersionNumber = new PackageVersion(packageDescriptor.versionNumber).getVersionNumber();
    const incrementedMajorVersion = new PackageVersion(packageDescriptor.versionNumber).increment(Positional.MAJOR);
    const incrementedMinorVersion = new PackageVersion(packageDescriptor.versionNumber).increment(Positional.MINOR);
    const incrementedPatchVersion = new PackageVersion(packageDescriptor.versionNumber).increment(Positional.PATCH);

    const newPackageVersion = await inquirer
      .prompt([
        {
          type: "list",
          name: "version",
          message: `Select a new version for ${packageDescriptor.package} (currently ${currentVersionNumber})`,
          choices: [
            {
              name: `Major (${incrementedMajorVersion})`,
              value: incrementedMajorVersion
            },
            {
              name: `Minor (${incrementedMinorVersion})`,
              value: incrementedMinorVersion
            },
            {
              name: `Patch (${incrementedPatchVersion})`,
              value: incrementedPatchVersion
            },
            {
              name: `Custom Version`,
              value: "Custom"
            },
            {
              name: `Skip Package`,
              value: currentVersionNumber
            }
          ],
        },
      ]);

      if (newPackageVersion.version === "Custom") {
        const customVersion = await this.getCustomVersion();
        return customVersion;
      }

      return newPackageVersion.version;
  }


  /**
   * prompt the user for the custom number when selected. Verifies the custom number is valid
   * @returns the customVersion if valid
   */
   private async getCustomVersion(): Promise<string> {
    const customVersion = await inquirer
      .prompt([
        {
          type: "input",
          name: "version",
          message: `Enter a custom version`,
          validate: (input, answers) => {
            const match = input.match(
              /^[0-9]+\.[0-9]+\.[0-9]+(\.[0-9]+|\.NEXT)?$/
            );
            if (match) {
              return true;
            } else {
              return 'Invalid version number. Must be of the format 1.0.0 , 1.0.0.0 or 1.0.0.0.NEXT'
            }
          }
        },
      ]);

      return new PackageVersion(customVersion.version).getVersionNumber()
  }

  /**
   * Checks whether positional is valid (major, minor or patch).
   * case-insensitive
   * @param positional
   * @returns true if positional is valid, otherwise false
   */
  private isValidPositional(positional: string) {
    return positional === Positional.MAJOR || positional === Positional.MINOR || positional === Positional.PATCH;
  }
}