import { flags } from "@oclif/command";
import SFPlogger, {
  COLOR_HEADER,
  COLOR_KEY_MESSAGE,
  COLOR_KEY_VALUE,
  COLOR_SUCCESS,
  COLOR_WARNING,
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import PickAnOrgWorkflow from "../workflows/org/PickAnOrgWorkflow";
import simpleGit, { SimpleGit } from "simple-git";
import CommandsWithInitCheck from "../sharedCommandBase/CommandsWithInitCheck";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import SourceStatusWorkflow from "../workflows/source/SourceStatusWorkflow";
import PullSource from "../workflows/source/PullSourceWorkflow";

export default class Pull extends CommandsWithInitCheck {
  static description =
    "pull source from scratch org/sandbox to the project. Provides interactive interface for packaging new metadata.";

  static examples = [`$ sfp pull -u <scratchorg>`];

  static flags = {
    help: flags.help({ char: "h" }),
  };

  // private readonly registry: MetadataRegistry = defaultRegistry;

  static hidden = true;

  async executeCommand() {

    let devOrg: string;

    //Intitialize Git
    const git: SimpleGit = simpleGit();
    let currentBranch = (await git.branch()).current;

    //Prompt to Pick a dev Org only if the devOrg is not available
    let workItem = this.sfpProjectConfig.getWorkItemGivenBranch(currentBranch);
    devOrg = workItem.defaultDevOrg;

    if (
      devOrg === undefined
    ) {
      SFPLogger.log(
        COLOR_WARNING("  Unable to find the assigned org for this work item")
      );
      devOrg = await new PickAnOrgWorkflow().getADevOrg();
    }

    let statusWorkflow = new SourceStatusWorkflow(devOrg);

    let statusResult = await statusWorkflow.execute();

    if (statusResult.length === 0) {
      SFPLogger.log(COLOR_SUCCESS("  No changes found"));
      return;
    }
    else
    {
      let pullWorkflow = new  PullSource(devOrg,statusResult);
      await pullWorkflow.execute();
    }



  }


}
