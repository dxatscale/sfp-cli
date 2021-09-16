import {flags} from '@oclif/command'
import inquirer = require('inquirer')
import SFPLogger, { LoggerLevel, ConsoleLogger } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PushErrorDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/PushErrorDisplayer";
import Pull from './pull';
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';
import simpleGit, { SimpleGit } from "simple-git";
import SourcePush from "../impl/sfdxwrappers/SourcePush";
import PromptToPickAnOrg from '../prompts/PromptToPickAnOrg';
import SourceStatus from "../impl/sfdxwrappers/SourceStatus";

export default class Sync extends CommandsWithInitCheck {
  static description = 'sync changes effortlessly either with repository or development environment'

  static flags = {
    help: flags.help({char: 'h'})
  }
  static args = [{name: 'file'}]

  async executeCommand() {

    let option = await this.promptAndCaptureOption();

    if(option === 'sync-git')
    {
      let args=new Array<string>();
      args.push("inner");

      const git = simpleGit();
      SFPLogger.log("Updating remote refs...");
      await git.fetch();

      const currentBranch = (await git.branch()).current;

      SFPLogger.log("Updating local branch with remote tracking branch");
      await git.pull("origin", currentBranch);

      const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(currentBranch);
      const parentBranch = workItem.trackingBranch;

      SFPLogger.log("Updating local branch with parent branch");
      await git.pull("origin", parentBranch);

      let response = await inquirer.prompt({
        type: "confirm",
        name: "isPush",
        message: "Push to remote tracking branch?"
      });

      if (response.isPush) await git.push("origin", currentBranch);
    }
    else if(option === 'sync-org')
    {
      let args=new Array<string>();
      args.push("inner");

      const devOrg = await new PromptToPickAnOrg().promptForDevOrgSelection();

      args.push(devOrg);

      // Determine direction
      const sourceStatusResult = await new SourceStatus(devOrg).exec(true);

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

        if (component.state.startsWith("Local")) isLocalChanges = true;

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
          let pull:Pull = new Pull(args,this.config);
          await pull.run();
        } else if (syncDirection.direction === "overwriteRemote") {
          await this.PushSourceToDevOrg(devOrg);
        } else {
          return;
        }

      } else if (isLocalChanges && isRemoteChanges) {
        let pull:Pull = new Pull(args,this.config);
        await pull.run();

        await this.PushSourceToDevOrg(devOrg);
      } else if (isLocalChanges) {
        await this.PushSourceToDevOrg(devOrg);
      } else if (isRemoteChanges) {
        let pull:Pull = new Pull(args,this.config);
        await pull.run();
      }
    }

  }


  private async PushSourceToDevOrg(devOrg: string) {
    try {
      SFPLogger.log(`Pushing source to org ${devOrg}`, LoggerLevel.INFO);
      await new SourcePush(devOrg, true).exec();
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
