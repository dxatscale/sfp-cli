import {flags} from '@oclif/command'
import inquirer = require('inquirer')
import Workon from './workon'
import SFPLogger, { COLOR_HEADER } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';

export default class WorkItem extends CommandsWithInitCheck {
  static description = 'create/switch/submit a workitem'

  static flags = {
    help: flags.help({char: 'h'})
  }

  static args = [{name: 'file'}]

  async executeCommand() {

    let topic = await this.promptAndCaptureOption();

    if(topic === 'Work on a new item')
    {
      let args=new Array<string>();
      args.push("inner");
      args.push("start");
      let workOn:Workon = new Workon(args,this.config);
      await workOn.run();
    }
    else if(topic === 'Switch to an existing work item')
    {
      let args=new Array<string>();
      args.push("inner");
      args.push("existing");
      let workOn:Workon = new Workon(args,this.config);
      await workOn.run();
    }

  }


  private async promptAndCaptureOption(): Promise<string> {
    const optionPrompt = await inquirer.prompt([
      {
        type: "list",
        name: "option",
        message: "Select an option to proceed?",
        choices: [
          "Work on a new item",
          "Switch to an existing work item",
          "Submit a work item"
        ],
        default: "Work on a new item "
      },
    ]);

    return optionPrompt.option;
  }
}
