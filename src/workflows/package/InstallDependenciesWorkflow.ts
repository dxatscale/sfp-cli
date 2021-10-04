import inquirer = require("inquirer");
import { SfpProjectConfig } from "../../types/SfpProjectConfig";
import InstallPackageDependenciesImpl from "@dxatscale/sfpowerscripts.core/lib/sfdxwrappers/InstallPackageDependenciesImpl";

export default class InstallDependenciesWorkflow
{

  constructor(private sfpProjectConfig:SfpProjectConfig,private username:string)
  {
  }

  public async execute()
  {
    let isPackageDependenciesToBeInstalled = await this.promptForInstallingDependencies();
    if(isPackageDependenciesToBeInstalled)
    {
     await this.installPackageDependencies();
    }


  }


  private async promptForInstallingDependencies(): Promise<boolean> {
    const isInstallDependenciesConfirmationPrompt = await inquirer.prompt([
      {
        type: "confirm",
        name: "install",
        message:
          "Do you want to install all the external dependencies to this org?",
      },
    ]);
    return isInstallDependenciesConfirmationPrompt.install;
  }

  private async installPackageDependencies()
  {
     // Install Dependencies
     let installDependencies: InstallPackageDependenciesImpl = new InstallPackageDependenciesImpl(
      this.username,
      this.sfpProjectConfig.defaultDevHub,
      120,
      null,
      null,
      true
    );

    await installDependencies.exec();

  }
}