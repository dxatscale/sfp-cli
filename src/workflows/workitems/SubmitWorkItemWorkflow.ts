import { SfpProjectConfig } from "../../types/SfpProjectConfig";
import simpleGit, { SimpleGit } from "simple-git";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import CommitWorkflow from "../git/CommitWorkflow";
import SourceStatusWorkflow from "../source/SourceStatusWorkflow";

export default class SubmitWorkItemWorkflow {

  constructor(private sfpProjectConfig: SfpProjectConfig) {}

  async execute() {
    const git = simpleGit();

    SFPLogger.log("Updating remote refs...");
    await git.fetch();

    const currentBranch = (await git.branch()).current;

    SFPLogger.log(`Updating local branch with remote tracking branch origin/${currentBranch}`);
    await git.pull("origin", currentBranch);

    const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(currentBranch);
    const parentBranch = workItem.trackingBranch;

    SFPLogger.log(`Updating local branch with parent branch origin/${parentBranch}`);
    await git.pull("origin", parentBranch);

    await new CommitWorkflow(git, this.sfpProjectConfig).execute();

    SFPLogger.log(`Pushing to origin/${currentBranch}`);
    await git.push("origin", currentBranch);
  }
}