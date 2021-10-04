import { SimpleGit } from "simple-git";
import { SfpProjectConfig } from "../../types/SfpProjectConfig";
import SFPLogger, { LoggerLevel, ConsoleLogger, COLOR_KEY_MESSAGE, COLOR_KEY_VALUE, COLOR_WARNING } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import SourceStatusWorkflow from '../source/SourceStatusWorkflow'
import PickAnOrgWorkflow from "../org/PickAnOrgWorkflow";
import inquirer = require('inquirer');
import PullSourceWorkflow from "../source/PullSourceWorkflow";
import CommitWorkflow from "../git/CommitWorkflow";
import cli from "cli-ux";
import SourcePush from "../../impl/sfdxwrappers/SourcePush";
import PushErrorDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/PushErrorDisplayer";

export default class SyncOrg {

  constructor(private git: SimpleGit, private sfpProjectConfig: SfpProjectConfig) {}

  async execute() {
    let branches = await this.git.branch();
    const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);



    //Only select org if there is no org available
    let devOrg;
    if(workItem?.defaultDevOrg == null)
    {
    SFPLogger.log(`  ${COLOR_WARNING(`Work Item not intialized, always utilize ${COLOR_KEY_MESSAGE(`sfp work`)} to intialize work`)}`)
    devOrg = await new PickAnOrgWorkflow().getADevOrg();
    //Reset source tracking when user picks up random orgs
    //await new SourceTrackingReset(devOrg).exec(true);
    }
    else
    {
      devOrg = workItem.defaultDevOrg
    }


    // Determine direction
    let statusWorkflow = new SourceStatusWorkflow(devOrg);
    let sourceStatusResult = await statusWorkflow.execute();


    let isLocalChanges: boolean = false;
    let isRemoteChanges: boolean = false;
    let isConflict: boolean = false;

    for (let component of sourceStatusResult) {
      if (component.state.endsWith("(Conflict)")) {
        isConflict = true;
        isLocalChanges = true;
        isRemoteChanges = true;
        break;
      }

      if (component.state.startsWith("Local"))
      {
      isLocalChanges = true;
      }
      if (component.state.startsWith("Remote")) isRemoteChanges = true;
    }

    if (isLocalChanges && isRemoteChanges && isConflict) {
      SFPLogger.log(
        "Source conflict(s) detected",
        LoggerLevel.WARN
      );
      let syncDirection = await inquirer.prompt({
        type: "list",
        name: "direction",
        message: "Choose to overwrite local or remote changes",
        choices: [
          {
            name: "Overwrite local changes",
            value: "overwriteLocal"
          },
          {
            name: "Overwrite remote changes",
            value: "overwriteRemote"
          },
          {
            name: "Abort",
            value: "abort"
          }
        ]
      });

      if (syncDirection.direction === "overwriteLocal") {
        let pullWorkflow: PullSourceWorkflow = new PullSourceWorkflow(devOrg,sourceStatusResult);
        await pullWorkflow.execute();

        await new CommitWorkflow(this.git, this.sfpProjectConfig).execute();

        // Push any non-conflicting locally added components
        await this.PushSourceToDevOrg(devOrg);
      } else if (syncDirection.direction === "overwriteRemote") {
        await this.PushSourceToDevOrg(devOrg);
      } else {
        return;
      }

    } else if (isLocalChanges && isRemoteChanges) {

      let pullWorkflow: PullSourceWorkflow = new PullSourceWorkflow(devOrg,sourceStatusResult);
      await pullWorkflow.execute();

      await new CommitWorkflow(this.git, this.sfpProjectConfig).execute();


      await this.PushSourceToDevOrg(devOrg);
    } else if (isLocalChanges) {
      await this.PushSourceToDevOrg(devOrg);
    } else if (isRemoteChanges) {

      let pullWorkflow: PullSourceWorkflow = new PullSourceWorkflow(devOrg,sourceStatusResult);
      await pullWorkflow.execute();

      await new CommitWorkflow(this.git, this.sfpProjectConfig).execute();


    }
    else
    {
     SFPLogger.log(`  ${COLOR_KEY_MESSAGE(`No Changes Detected... `)}`);
    }
  }

  private async PushSourceToDevOrg(devOrg: string) {
    try {
      cli.action.start(`  Pushing source to org ${COLOR_KEY_VALUE(devOrg)}`);
      await new SourcePush(devOrg, true).exec();
      cli.action.stop();
    } catch (error) {
      PushErrorDisplayer.printMetadataFailedToPush(JSON.parse(error.message), new ConsoleLogger());
      throw new Error("Failed to push source");
    }
  }
}