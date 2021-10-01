import {flags} from '@oclif/command'
import inquirer = require('inquirer')
import SFPLogger, { LoggerLevel, ConsoleLogger, COLOR_KEY_MESSAGE, COLOR_KEY_VALUE, COLOR_WARNING } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PushErrorDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/PushErrorDisplayer";
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';
import simpleGit, { SimpleGit } from "simple-git";
import SourcePush from "../impl/sfdxwrappers/SourcePush";
import PickAnOrgWorkflow from '../workflows/org/PickAnOrgWorkflow';
import SourceStatus from "../impl/sfdxwrappers/SourceStatus";
import cli from "cli-ux";
import { WorkItem } from '../types/WorkItem';
import PulSourceWorkflow from '../workflows/source/PullSourceWorkflow';
import SourceStatusDisplayer from '../impl/displayer/SourceStatusDisplayer';
import SourceTrackingReset from '../impl/sfdxwrappers/SourceTrackingReset';
import SourceStatusWorkflow from '../workflows/source/SourceStatusWorkflow';
import CommitWorkflow from "../workflows/git/CommitWorkflow";

export default class Sync extends CommandsWithInitCheck {
  static description = 'sync changes effortlessly either with repository or development environment'

  static flags = {
    help: flags.help({char: 'h'})
  }

  workItem: WorkItem;

  async executeCommand() {

    let option = await this.promptAndCaptureOption();

    const git = simpleGit();
    if(option === 'sync-git')
    {
      let args=new Array<string>();
      args.push("inner");

      SFPLogger.log("Updating remote refs...");
      await git.fetch();

      const currentBranch = (await git.branch()).current;

      SFPLogger.log(`Updating local branch with remote tracking branch origin/${currentBranch}`);
      await git.pull("origin", currentBranch);

      const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(currentBranch);
      const parentBranch = workItem.trackingBranch;

      SFPLogger.log(`Updating local branch with parent branch origin/${parentBranch}`);
      await git.pull("origin", parentBranch);

      let response = await inquirer.prompt({
        type: "confirm",
        name: "isPush",
        message: "Push to remote tracking branch?"
      });

      if (response.isPush) {
        SFPLogger.log(`Pushing to origin/${currentBranch}`);
        await git.push("origin", currentBranch);
      }
    }
    else if(option === 'sync-org')
    {
      let args=new Array<string>();
      args.push("inner");

      let branches = await git.branch();
      this.workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);



      //Only select org if there is no org available
      let devOrg;
      if(this.workItem?.defaultDevOrg==null)
      {
      SFPLogger.log(`  ${COLOR_WARNING(`Work Item not intialized, always utilize ${COLOR_KEY_MESSAGE(`sfp work`)} to intialize work`)}`)
      devOrg = await new PickAnOrgWorkflow().getADevOrg();
      //Reset source tracking when user picks up random orgs
      //await new SourceTrackingReset(devOrg).exec(true);
      }
      else
      {
        devOrg = this.workItem.defaultDevOrg
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
          let pullWorkflow:PulSourceWorkflow = new PulSourceWorkflow(devOrg,sourceStatusResult);
          await pullWorkflow.execute();

          await new CommitWorkflow(git, this.sfpProjectConfig).execute();

          // Push any non-conflicting locally added components
          await this.PushSourceToDevOrg(devOrg);
        } else if (syncDirection.direction === "overwriteRemote") {
          await this.PushSourceToDevOrg(devOrg);
        } else {
          return;
        }

      } else if (isLocalChanges && isRemoteChanges) {

        let pullWorkflow:PulSourceWorkflow = new PulSourceWorkflow(devOrg,sourceStatusResult);
        await pullWorkflow.execute();

        await new CommitWorkflow(git, this.sfpProjectConfig).execute();


        await this.PushSourceToDevOrg(devOrg);
      } else if (isLocalChanges) {
        await this.PushSourceToDevOrg(devOrg);
      } else if (isRemoteChanges) {

        let pullWorkflow:PulSourceWorkflow = new PulSourceWorkflow(devOrg,sourceStatusResult);
        await pullWorkflow.execute();

        await new CommitWorkflow(git, this.sfpProjectConfig).execute();


      }
      else
      {
       SFPLogger.log(`  ${COLOR_KEY_MESSAGE(`No Changes Detected... `)}`);
      }
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

  private async promptAndCaptureOption(): Promise<string> {
    const optionPrompt = await inquirer.prompt([
      {
        type: "list",
        name: "option",
        message: "Select an option to proceed?",
        choices: [
          { name: "Sync local with remote repository",value:"sync-git"},
          { name: "Sync local with Dev Org",value:"sync-org"},
        ],
        default: "Sync local with remote repository"
      },
    ]);

    return optionPrompt.option;
  }
}
