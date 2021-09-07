import {Command, flags} from '@oclif/command'
import inquirer = require("inquirer");
inquirer.registerPrompt(
  "autocomplete",
  require("inquirer-autocomplete-prompt")
);
import SFPlogger, {
  COLOR_ERROR,
  COLOR_HEADER, COLOR_KEY_MESSAGE, COLOR_SUCCESS, COLOR_WARNING,
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import OrgAuth from '../impl/sfdxwrappers/OrgAuth';
import PromptToPickAnOrg from '../prompts/PromptToPickAnOrg';
import { fs, Org } from '@salesforce/core';
import PoolListImpl from '../impl/pool/PoolListImpl';
import { isEmpty } from "lodash";
import ScratchOrg from '@dxatscale/sfpowerscripts.core/lib/scratchorg/ScratchOrg';
import path = require("path");


export default class Init extends Command {
  static description = 'describe the command here'

  static flags = {
    help: flags.help({char: 'h'})
  }

  static args = [{ name: "caller" }, { name: "mode" }];

  sfpProjectConfig;

  async run() {
    const {args, flags} = this.parse(Init)



    let projectName=`${path.basename(process.cwd())}`;
    try
    {
    this.sfpProjectConfig = fs.readJsonSync(path.join(this.config.configDir, `${projectName}.json`))
    } catch(error){
      console.log(COLOR_WARNING(`Project not initialized yet, Initializing...`));
    }



  if(args.caller!=='inner')
    SFPlogger.log(
      COLOR_HEADER(`sfp cli -- The DX@Scale Dev CLI -- ${this.config.version}`)
    );


    if (!fs.existsSync("sfdx-project.json"))
    throw new Error(
      "This command must be run in the root directory of a SFDX project"
    );


    //TODO: check for DX@Scale project

     let defaultBranch = await this.promptForDefaultBranch();
     let isDevHubAuthRequired = await this.promptForNeedForDevHub();
     if(isDevHubAuthRequired)
     {
       let instanceURL = await this.promptForInstanceURL();
       try
       {
       let orgAuth = new OrgAuth(instanceURL);
       await orgAuth.exec(false);
       }
       catch(error)
       {
        console.log(COLOR_ERROR(`Unable to authenticate to the org, Please try agin later or fix the error below`));
        throw error;
       }

     }
     let devHubUserName = await new PromptToPickAnOrg({username:this.sfpProjectConfig.defaultDevHub}).promptForDevHubSelection();

     const hubOrg = await Org.create({ aliasOrUsername: devHubUserName });
     let scratchOrgsInDevHub = await new PoolListImpl(
            hubOrg,
            null,
            true
          ).execute();

     let tags = this.getPoolTags(scratchOrgsInDevHub);

     let selectedTag;
     if (!isEmpty(tags)) {
        selectedTag = await this.promptForPoolSelection(tags);
      }



     fs.mkdirpSync(this.config.configDir);
     fs.writeJsonSync(path.join(this.config.configDir,`${projectName}.json`),{ name:projectName, defaultBranch:defaultBranch, defaultDevHub:devHubUserName,defaultPool:selectedTag})

     console.log(COLOR_SUCCESS(`Project ${projectName} succesfully intiialized`));

  }


  private async promptForPoolSelection(pools: Array<string>): Promise<string> {
    const pool = await inquirer.prompt([
      {
        type: "list",
        name: "tag",
        message:
          "Select a Default Scratch Org Pool",
        choices: pools,
        default: this.sfpProjectConfig.defaultPool
      },
    ]);
    return pool.tag;
  }

  private getPoolTags(result: ScratchOrg[]):string[] {

    let tagCounts: any = result.reduce(function (obj, v) {
      obj[v.tag] = (obj[v.tag] || 0) + 1;
      return obj;
    }, {});

    let tagArray = new Array<string>();

    Object.keys(tagCounts).forEach(function (key) {
      if (tagCounts[key] > 1)
        tagArray.push(key);
    });

    return tagArray;
  }


  private async promptForNeedForDevHub(): Promise<boolean> {
    const isDevHubAuthRequiredPrompt = await inquirer.prompt([
      {
        type: "confirm",
        name: "isDevHubAuthRequired",
        message: "Associate a new devhub with this project?",
        default: false
      },
    ]);
    return isDevHubAuthRequiredPrompt.isDevHubAuthRequired;
  }


  private async promptForInstanceURL(): Promise<string> {
    const instanceURLPrompt = await inquirer.prompt([
      {
        type: "input",
        name: "instanceURL",
        message: "Instance URL of the org, in format MyDomainName.my.salesforce.com or leave blank to use login.salesforce.com",
      },
    ]);

    return instanceURLPrompt.instanceURL;
  }


  private async promptForDefaultBranch(): Promise<string> {
    const defaultBranchPrompt = await inquirer.prompt([
      {
        type: "input",
        name: "branch",
        message: "Default git branch for this repo",
        default:this.sfpProjectConfig?.defaultBranch?  this.sfpProjectConfig?.defaultBranch : "main"
      },
    ]);

    return defaultBranchPrompt.branch;
  }




}
