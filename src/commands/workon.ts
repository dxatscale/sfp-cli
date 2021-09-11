import { flags } from "@oclif/command";
import * as fs from "fs-extra";
import inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);
import SFPlogger, {
  COLOR_HEADER,
  COLOR_KEY_MESSAGE,
  COLOR_SUCCESS,
  COLOR_WARNING,
  LoggerLevel,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { isEmpty } from "lodash";
import { Org } from "@salesforce/core";
import PoolListImpl from "../impl/pool/PoolListImpl";
import ScratchOrg from "@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg";
import PoolFetchImpl from "../impl/pool/PoolFetchImpl";
import InstalledAritfactsFetcher from "@dxatscale/sfpowerscripts.core/lib/artifacts/InstalledAritfactsFetcher";
import InstalledArtifactsDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/InstalledArtifactsDisplayer";
import InstalledPackagesFetcher from "@dxatscale/sfpowerscripts.core/lib/package/installedPackages/InstalledPackagesFetcher";
import InstalledPackageDisplayer from "@dxatscale/sfpowerscripts.core/lib/display/InstalledPackagesDisplayer";
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import cli from "cli-ux";
import simpleGit, { SimpleGit } from "simple-git";
import path = require("path");
import Init from "./init";
import SfpCommand from "../SfpCommand";
import { WorkItem } from "../types/WorkItem";
import { SfpProjectConfig } from "../types/SfpProjectConfig";

export default class Workon extends SfpCommand {
  static description = "Interactive command to initiate a new work item using the DX@Scale flow";

  static flags = {
    help: flags.help({ char: "h" }),
  };

  // hide the command from help
  static hidden = true;

  static args = [{ name: "caller" }, { name: "mode" }];
  orgList: any;
  workItem: WorkItem;
  sfpProjectConfig: SfpProjectConfig = {};

  async exec() {

    if (this.sfpProjectConfig === null || this.sfpProjectConfig === undefined) {
      let args = new Array<string>();
      args.push("inner");
      let init: Init = new Init(args, this.config);
      await init.run();
      this.sfpProjectConfig = await fs.readJSON(
        path.join(this.config.configDir, `${this.projectName}.json`)
      );
    }

    SFPlogger.log(COLOR_KEY_MESSAGE("Provide details of the workitem"));

    let workItemId = await this.promptAndCaptureWorkItem();
    this.workItem = new WorkItem(workItemId);


   //Check config whether workItem is available
   if (this.sfpProjectConfig.workItems[this.workItem.id]) {
    SFPlogger.log(
      COLOR_WARNING("Workitem already exists.. Switching to workItem")
    );
    //Get existing workItem detail
    this.workItem = this.sfpProjectConfig.workItems[this.workItem.id];
  } else {
    //Get Type
    this.workItem.type = await this.promptForWorkItemType();

    //Get  Tracking branch
    this.workItem.trackingBranch = await this.promptAndCaptureTrackingBranch(
      this.sfpProjectConfig.defaultBranch
    );
  }

    let branchName = `${this.workItem.type}/${this.workItem.id.toUpperCase()}`;

    //Switch Git
    cli.action.start(` Sync Git Repository...`);
    const git: SimpleGit = simpleGit();
    await git.fetch("origin");
    cli.action.stop();

    //Get Branch choices
    let branchChoices = await this.getBranchChoice(git, branchName);

    //Create or switch branch
    if (branchChoices[0].value === "create") {
      await git.checkoutBranch(
        branchName,
        `remotes/origin/${this.sfpProjectConfig.defaultBranch}`
      );
      console.log(
        COLOR_KEY_MESSAGE(
          ` Created new branch ${COLOR_HEADER(branchName)} from ${COLOR_HEADER(
            `origin/${this.sfpProjectConfig.defaultBranch}`
          )}`
        )
      );
      this.workItem.branch = branchName;
    } else if (branchChoices[0].value === "switch") {
      await git.checkout(branchName);
      console.log(
        COLOR_KEY_MESSAGE(`Switched to existing branch ${branchName}`)
      );
    } else {
      let option = await this.promptForBranchSelection(branchChoices);
      if (option === "switch") {
        await git.checkout(branchName);
        console.log(
          COLOR_KEY_MESSAGE(
            ` Switched to existing branch ${COLOR_HEADER(branchName)}`
          )
        );
      } else if (option === "new") {
        await git.deleteLocalBranch(branchName);
        console.log(
          COLOR_KEY_MESSAGE(
            ` Deleted existing local branch ${COLOR_HEADER(branchName)}`
          )
        );
        await git.checkoutBranch(
          branchName,
          `remotes/origin/${this.sfpProjectConfig.defaultBranch}`
        );
        console.log(
          COLOR_KEY_MESSAGE(
            ` Created new branch ${COLOR_HEADER(
              branchName
            )} from ${COLOR_HEADER(
              `origin/${this.sfpProjectConfig.defaultBranch}`
            )}`
          )
        );
      }
    }

    //Assign Dev Environment in both cases
    let isDevEnvironmentRequired = await this.promptForNeedForDevEnvironment();
    if (isDevEnvironmentRequired) {
      try {
        let devHubUserName = this.sfpProjectConfig.defaultDevHub;

        let type = await this.promptForOrgTypeSelection();

        if (type === "pool") {
          // Now Fetch All Pools in that devhub
          const hubOrg = await Org.create({ aliasOrUsername: devHubUserName });
          let scratchOrgsInDevHub = await new PoolListImpl(
            hubOrg,
            null,
            true
          ).execute();

          let tags = this.getPoolTags(scratchOrgsInDevHub);

          if (!isEmpty(tags)) {
            let selectedTag = await this.promptForPoolSelection(
              tags,
              this.sfpProjectConfig.defaultPool
            );
            cli.action.start(
              ` Fetching a scratchorg from ${selectedTag} pool `
            );
            let fetchedOrg = await this.fetchOrg(
              hubOrg,
              selectedTag,
              this.workItem.id
            );

            this.workItem.defaultDevOrg = fetchedOrg.username;
            cli.action.stop();
            await this.displayOrgContents(fetchedOrg);
            console.log();
            console.log(
              COLOR_SUCCESS(
                `Sucesfully fetched a new dev environment with alias ${this.workItem.id}`
              )
            );
            console.log(
              COLOR_KEY_MESSAGE(
                `Switched to branch ${branchName}..utilize 'sfp sync ${this.workItem.id}' to operate this environment`
              )
            );
          } else {
            let isDevEnvironmentCreationRequested =
              await this.promptForCreatingDevEnvironmentIfPoolEmpty();
            if (isDevEnvironmentCreationRequested)
              await this.createOrg(this.workItem.id, "so");
          }
        } else {
          await this.createOrg(this.workItem.id, type);
        }
      } catch (error) {
        throw error(`Unable to process request at this time `, error);
      }
    }

    if (
      this.sfpProjectConfig.workItems == null ||
      this.sfpProjectConfig.workItems == undefined
    ) {
      this.sfpProjectConfig.workItems = {};
    } else {
      this.disableExistingWorkItems();
    }

    //Commit back
    this.sfpProjectConfig.workItems[this.workItem.id] = this.workItem;
    this.sfpProjectConfig.workItems[this.workItem.id].isActive = true;

    fs.writeJSONSync(
      path.join(this.config.configDir, `${this.projectName}.json`),
      this.sfpProjectConfig
    );
  }

  private async getBranchChoice(
    git: SimpleGit,
    branchName: String
  ): Promise<{ name: string; value: string }[]> {
    let branchChoices: any;
    let branches = await git.branch();
    let isLocalBranchAvailable: boolean = false;
    let isRemoteBranchAvailable: boolean = false;

    if (
      branches.all.find(
        (branch) => branch.toLowerCase() === branchName.toLowerCase()
      )
    ) {
      isLocalBranchAvailable = true;
    }
    if (
      branches.all.find(
        (branch) =>
          branch.toLowerCase() === `remotes/origin/${branchName}`.toLowerCase()
      )
    ) {
      isRemoteBranchAvailable = true;
    }

    if (isLocalBranchAvailable && !isRemoteBranchAvailable) {
      branchChoices = [
        { name: "Switch to the existing branch", value: "switch" },
        {
          name: "Delete & Create a new local branch (destructive)",
          value: "new",
        },
      ];
    } else if (!isLocalBranchAvailable && isRemoteBranchAvailable) {
      branchChoices = [
        { name: "Switch to the existing branch", value: "switch" },
      ];
    } else if (isLocalBranchAvailable && isRemoteBranchAvailable) {
      branchChoices = [
        { name: "Switch to the existing branch", value: "switch" },
      ];
    } else {
      branchChoices = [{ name: "Create new branch", value: "create" }];
    }
    return branchChoices;
  }

  private async promptAndCaptureWorkItem(): Promise<string> {
    const workItem = await inquirer.prompt([
      {
        type: "input",
        name: "id",
        message: "Input Id for the Work Item",
        validate: this.validateInput,
      },
    ]);

    return workItem.id;
  }

  private async promptAndCaptureTrackingBranch(
    defaultBranch: string
  ): Promise<string> {
    const branchPrompt = await inquirer.prompt([
      {
        type: "input",
        name: "branch",
        message: "What branch should this workitem track?",
        default: defaultBranch,
      },
    ]);
    return branchPrompt.branch;
  }

  private async promptForWorkItemType(): Promise<string> {
    const workItemTypePrompt = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "Select the type of work item that you are building:",
        choices: [
          { name: "feat: A new feature", value: "feature" },
          { name: "fix:  A bugfix", value: "bugfix" },
          {
            name: "chore:  changes to scripts/test/readme etc.",
            value: "chore",
          },
          {
            name: "refactor:  A code change that neither fixes a bug or adds a feature",
            value: "refactor",
          },
        ],
      },
    ]);

    return workItemTypePrompt.type;
  }

  private async promptForNeedForDevEnvironment(): Promise<boolean> {
    const isDevEnvironmentRequiredPrompt = await inquirer.prompt([
      {
        type: "confirm",
        name: "isDevEnvironmentRequired",
        message: "Do you need a new dev environment?",
        default: true,
      },
    ]);
    return isDevEnvironmentRequiredPrompt.isDevEnvironmentRequired;
  }

  private async promptForCreatingDevEnvironmentIfPoolEmpty(): Promise<boolean> {
    const isCreateDevEnvironmentRequiredPrompt = await inquirer.prompt([
      {
        type: "confirm",
        name: "create",
        message:
          "No scratch orgs available in pool, Create an new scratch org (This would take a considerable time)?",
      },
    ]);
    return isCreateDevEnvironmentRequiredPrompt.create;
  }

  private async promptForPoolSelection(
    pools: Array<any>,
    defaultPool: string
  ): Promise<string> {
    const pool = await inquirer.prompt([
      {
        type: "list",
        name: "tag",
        message:
          "Select a Scratch Org Pool (Only pools with more than 2 orgs are displayed)",
        choices: pools,
        default: { name: defaultPool, value: defaultPool },
      },
    ]);
    return pool.tag;
  }

  private async promptForOrgTypeSelection(): Promise<string> {
    const orgType = await inquirer.prompt([
      {
        type: "list",
        name: "type",
        message: "Select a type of dev environment",
        choices: [
          { name: "Fetch a scratchorg from pool", value: "pool" },
          { name: "Create a scratchorg", value: "so" },
          { name: "Create a dev sandbox", value: "sb" },
        ],
      },
    ]);
    return orgType.type;
  }

  private async promptForBranchSelection(branchChoices): Promise<string> {
    const branchResolution = await inquirer.prompt([
      {
        type: "list",
        name: "option",
        message:
          "A branch with the name already exists, Please select from the following resolution",
        choices: branchChoices,
        default: { name: "Delete & Create a new local branch", value: "new" },
      },
    ]);
    return branchResolution.option;
  }

  private async displayOrgContents(scratchOrg: ScratchOrg) {
    try {
      console.log();

      const scratchOrgConnection = (
        await Org.create({ aliasOrUsername: scratchOrg.username })
      ).getConnection();
      let installedPackagesFetcher = new InstalledPackagesFetcher(
        scratchOrgConnection
      );
      let installedManagedPackages =
        await installedPackagesFetcher.fetchManagedPackages();
      SFPLogger.log("Installed managed packages:", LoggerLevel.INFO);
      InstalledPackageDisplayer.printInstalledPackages(
        installedManagedPackages,
        null
      );

      let installedArtifacts =
        await InstalledAritfactsFetcher.getListofArtifacts(scratchOrg.username);
      InstalledArtifactsDisplayer.printInstalledArtifacts(
        installedArtifacts,
        null
      );
    } catch (error) {
      SFPLogger.log(
        "Failed to query packages/artifacts installed in the org",
        LoggerLevel.ERROR
      );
    }
  }

  private async fetchOrg(
    hubOrg: Org,
    pool: string,
    alias: string
  ): Promise<ScratchOrg> {
    let poolFetchImpl = new PoolFetchImpl(
      hubOrg,
      pool,
      false,
      false,
      null,
      alias,
      true
    );

    return poolFetchImpl.execute();
  }

  private async createOrg(alias: string, type: string) {}

  private getPoolTags(result: ScratchOrg[]) {
    let availableSo = [];
    if (result.length > 0) {
      availableSo = result.filter((soInfo) => soInfo.status === "Available");
    }

    let tagCounts: any = availableSo.reduce(function (obj, v) {
      obj[v.tag] = (obj[v.tag] || 0) + 1;
      return obj;
    }, {});

    let tagArray = new Array<any>();

    Object.keys(tagCounts).forEach(function (key) {
      if (tagCounts[key] > 1)
        tagArray.push({
          name: key,
          value: key,
        });
    });

    return tagArray;
  }

  private async validateInput(answers, input) {
    if (answers.length >= 4) return true;
    else
      return "Please enter a valid issue number with a minimum of 4 characters such as APR-1 or issue-1 etc";
  }

  private disableExistingWorkItems() {
    for (const [key] of Object.entries(this.sfpProjectConfig.workItems)) {
      this.sfpProjectConfig.workItems[key].isActive = false;
    }
  }
}
