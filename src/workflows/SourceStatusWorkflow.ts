import cli from "cli-ux";
import SourceStatus from "../impl/sfdxwrappers/SourceStatus";

import inquirer = require("inquirer");
import SFPLogger, {
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import SourceStatusDisplayer from "../impl/displayer/SourceStatusDisplayer";


export default class SourceStatusWorkflow
{

  public constructor(private targetOrg:string)
  {

  }

  public async execute() {
    let statusResult;
    let result;
    try {
      cli.action.start(`  Checking for changes in  dev org ${this.targetOrg}..`);
      result = await new SourceStatus(this.targetOrg).exec(true);
      cli.action.stop();
    } catch (error) {
      cli.action.stop();
      return "Missing DevOrg";
    }

    const conflicts = result.filter((elem) =>
      elem.state.endsWith("(Conflict)")
    );

    if (conflicts.length > 0) {
      await this.conflictsHandler(conflicts);
    }

     statusResult = result
      .filter((elem) => !elem.state.startsWith("Local"))
      .map((elem) => {
        elem.state = elem.state.replace(/\(Conflict\)$/, "");
        return elem;
      });

    this.printStatus(statusResult);

    return statusResult;
  }


  private async conflictsHandler(conflicts: any) {
   new SourceStatusDisplayer(conflicts).display();
    SFPLogger.log(
      "Source conflict(s) detected. Verify that you want to keep the remote versions",
      LoggerLevel.WARN
    );
    const getConfirmationForOverwrite = await inquirer.prompt([
      {
        type: "input",
        name: "overwrite",
        message: "To forcibly overwrite local changes, type force",
      },
    ]);

    if (getConfirmationForOverwrite.overwrite !== "force") {
      throw new Error("Source conflict(s) detected. Abandoning...");
    }
  }
}