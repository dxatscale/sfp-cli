import OrgList from "../impl/sfdxwrappers/OrgList";
import { isEmpty } from "lodash";
import inquirer = require("inquirer");
import cli from "cli-ux";

export default class PromptToPickAnOrg {
  private orgList: any;

  constructor(private defaultDevHubUsername?:string)
  {
  }

  private async getListofAuthenticatedOrgs() {
    let orgList: OrgList = new OrgList();
    return  orgList.exec(true);
  }

  private getListOfAuthenticatedLocalDevHubs(): Array<string> {
    if (!isEmpty(this.orgList.nonScratchOrgs)) {
      let devHubOrgs = this.orgList.nonScratchOrgs.filter(
        (orgs) => orgs.isDevHub === true
      );
      let devhubUserList = new Array<string>();
      devHubOrgs.map((element) => {
        devhubUserList.push(element.username);
      });
      return devhubUserList;
    } else {
      throw new Error("Unable to find any devhubs");
    }
  }

  private getListOfScratchOrgs(): Array<string> {
    if (!isEmpty(this.orgList.scratchOrgs)) {
      let scratchOrgList = new Array<string>();
      this.orgList.scratchOrgs.map((element) => {
        scratchOrgList.push(element.username);
      });
      return scratchOrgList;
    } else {
      throw new Error("Unable to find any scratch orgs");
    }
  }

  public async promptForDevHubSelection(): Promise<string> {
    await this.fetchOrgs();


    let devHubOrgUserNameList = this.getListOfAuthenticatedLocalDevHubs();
    const devhub = await inquirer.prompt([
      {
        type: "list",
        name: "username",
        message: "Pick a DevHub",
        choices: devHubOrgUserNameList,
        default:  this.defaultDevHubUsername
      },
    ]);

    return devhub.username;
  }

  public async promptForScratchOrgSelection(): Promise<string> {
    await this.fetchOrgs();

    let scratchOrgList = this.getListOfScratchOrgs();

    const devhub = await inquirer.prompt([
      {
        type: "list",
        name: "username",
        message: "Pick a Scratch Org",
        choices: scratchOrgList,
      },
    ]);

    return devhub.username;
  }

  private async fetchOrgs() {
    cli.action.start(` Fetching Orgs...`);
    if (!this.orgList)
      this.orgList = await this.getListofAuthenticatedOrgs();

    cli.action.stop();
  }
}
