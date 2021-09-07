import OrgList from "../impl/sfdxwrappers/OrgList";
import { isEmpty } from "lodash";
import inquirer = require("inquirer");
import cli from "cli-ux";
import { convertAliasToUsername } from "@dxatscale/sfpowerscripts.core/lib/utils/AliasList"

export default class PromptToPickAnOrg {
  private orgList: any;



  constructor(private defaultOrg?:{username?:string,alias?:string})
  {
    if((defaultOrg.username==null || defaultOrg.username == undefined) && defaultOrg.alias )
    {
      defaultOrg.username = convertAliasToUsername(defaultOrg.alias);
    }



  }

  private async getListofAuthenticatedOrgs() {
    let orgList: OrgList = new OrgList();
    return  orgList.exec(true);


  }

  private getListOfAuthenticatedLocalDevHubs(): Array<{name:string,alias:string,value:string}> {
    if (!isEmpty(this.orgList.nonScratchOrgs)) {
      let devHubOrgs = this.orgList.nonScratchOrgs.filter(
        (orgs) => orgs.isDevHub === true
      );
      let devhubUserList = new Array<{name:string,alias:string,value:string}>();
      devHubOrgs.map((element) => {
        devhubUserList.push({name:`${element.username} - ${element.alias}`,alias:element.alias,value:element.username});
      });
      return devhubUserList;
    } else {
      throw new Error("Unable to find any devhubs");
    }
  }

  private getListOfScratchOrgs(): Array<{name:string,alias:string,value:string}> {
    if (!isEmpty(this.orgList.scratchOrgs)) {
      let scratchOrgList = new Array<{name:string,alias:string,value:string}>();
      this.orgList.scratchOrgs.map((element) => {
        scratchOrgList.push({name:`${element.username} - ${element.alias}`,alias:element.alias,value:element.username});
      });
      return scratchOrgList;
    } else {
      throw new Error("Unable to find any scratch orgs");
    }
  }

  public async promptForDevHubSelection(): Promise<string> {
    await this.fetchOrgs();


    let devHubOrgUserNameList = this.getListOfAuthenticatedLocalDevHubs();
    let defaultChoiceIndex =devHubOrgUserNameList.findIndex(element=>element.alias==this.defaultOrg.alias || element.value == this.defaultOrg.username)
    const devhub = await inquirer.prompt([
      {
        type: "list",
        name: "username",
        message: "Pick a DevHub",
        choices: devHubOrgUserNameList,
        default:  defaultChoiceIndex
      }
    ]);

    return devhub.username;
  }

  public async promptForScratchOrgSelection(): Promise<string> {
    await this.fetchOrgs();

    let scratchOrgList = this.getListOfScratchOrgs();
    let defaultChoiceIndex =scratchOrgList.findIndex(element=>element.alias==this.defaultOrg.alias || element.value == this.defaultOrg.username)

    const devhub = await inquirer.prompt([
      {
        type: "list",
        name: "username",
        message: "Pick a Scratch Org",
        choices: scratchOrgList,
        default: defaultChoiceIndex
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
