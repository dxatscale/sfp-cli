import { SfpProjectConfig } from "../../types/SfpProjectConfig";
import simpleGit, { SimpleGit } from "simple-git";
import SFPLogger, { COLOR_KEY_MESSAGE, COLOR_WARNING, LoggerLevel } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import CommitWorkflow from "../git/CommitWorkflow";
import SourceStatusWorkflow from "../source/SourceStatusWorkflow";
import SyncGit from "../sync/SyncGit";
import inquirer = require('inquirer');
import SyncOrg from "../sync/SyncOrg";
import PushSourceToOrg from "../../impl/sfpcommands/PushSourceToOrg";
import PickAnOrgWorkflow from "../org/PickAnOrgWorkflow";
import child_process = require('child_process');

export default class SubmitWorkItemWorkflow {
  private devOrg: string;

  constructor(private sfpProjectConfig: SfpProjectConfig) {}

  async execute() {
    const git = simpleGit();

    if (await this.isSyncGit()) {
      await new SyncGit(git, this.sfpProjectConfig).execute();
    }

    if (await this.isSyncOrg()) {
      const devOrg = await this.getDevOrg(git);
      await new SyncOrg(git, this.sfpProjectConfig, devOrg).execute();
    }

    if (await this.isPushSourceToOrg()) {
      const devOrg = await this.getDevOrg(git);
      await new PushSourceToOrg(devOrg).exec();
    }

    await new CommitWorkflow(git, this.sfpProjectConfig).execute();

    const currentBranch = (await git.branch()).current;
    SFPLogger.log(`Pushing to origin/${currentBranch}`);
    await git.push("origin", currentBranch);

    if (await this.isCreatePullRequest() && await this.isGitHubCliInstalled()) {
      child_process.execSync("gh pr create", {stdio: 'inherit', encoding: 'utf8'});
    }
  }

  private async getDevOrg(git: SimpleGit): Promise<string> {
    // Return devOrg if already set
    if (this.devOrg) return this.devOrg;

    const branches = await git.branch();
    const workItem = this.sfpProjectConfig.getWorkItemGivenBranch(branches.current);

    if(workItem?.defaultDevOrg == null) {
      SFPLogger.log(`  ${COLOR_WARNING(`Work Item not intialized, always utilize ${COLOR_KEY_MESSAGE(`sfp work`)} to intialize work`)}`)
      this.devOrg = await new PickAnOrgWorkflow().getADevOrg();
    } else {
      this.devOrg = workItem.defaultDevOrg
    }

    return this.devOrg;
  }

  private async isSyncGit(): Promise<boolean> {
    const answers = await inquirer.prompt(
      {
        type: "confirm",
        name: "isSyncGit",
        message: "Sync local with remote repository?"
      }
    );

    return answers.isSyncGit;
  }

  private async isSyncOrg(): Promise<boolean> {
    const answers = await inquirer.prompt(
      {
        type: "confirm",
        name: "isSyncOrg",
        message: "Sync local with Dev org?"
      }
    );

    return answers.isSyncOrg;
  }

  private async isPushSourceToOrg(): Promise<boolean> {
    const answers = await inquirer.prompt(
      {
        type: "confirm",
        name: "isPushSourceToOrg",
        message: "Push ALL source to Dev org?"
      }
    )

    return answers.isPushSourceToOrg;
  }

  private async isCreatePullRequest(): Promise<boolean> {
    const answers = await inquirer.prompt({
      type: "confirm",
      name: "isCreatePullRequest",
      message: "Create pull request?"
    })

    return answers.isCreatePullRequest;
  }

  private isGitHubCliInstalled(): boolean {
    let isGitHubCliInstalled: boolean;
    try {
      child_process.execSync("gh --version", {stdio: 'pipe', encoding: 'utf8'});
      isGitHubCliInstalled = true;
    } catch (error) {
      isGitHubCliInstalled = false;
      SFPLogger.log("Install the GitHub CLI to enable creation of pull requests", LoggerLevel.ERROR);
    }
    return isGitHubCliInstalled;
  }
}