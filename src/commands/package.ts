import { flags } from "@oclif/command";
import inquirer = require("inquirer");
import CommandsWithInitCheck from "../sharedCommandBase/CommandsWithInitCheck";
import PackageVersionWorkflow from "../workflows/package/PackageVersionWorkflow";


export default class Package extends CommandsWithInitCheck {

  public static description = "Helps to manage packages";

  static flags = {
    help: flags.help({ char: "h" }),
  };



  protected async executeCommand(): Promise<any> {
    let commandSelected = await this.promptForCommandSelection();
    if(commandSelected == PackageCommand.VERSION_COMMAND)
    {
       let packageVersionWorkflow:PackageVersionWorkflow = new PackageVersionWorkflow();
       await packageVersionWorkflow.execute();
    }
  }



  private async promptForCommandSelection(): Promise<PackageCommand> {
    const operation = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "Select an operation",
        choices: [
          { name: "Manage Version of Packages", value: PackageCommand.VERSION_COMMAND },
        ],
      },
    ]);
    return operation.type;
  }




}

enum PackageCommand {
  VERSION_COMMAND = 1,
}