import {Command, flags} from '@oclif/command'
import inquirer = require('inquirer')
import Workon from './workon'
import SFPLogger, { COLOR_HEADER } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export default class WorkItem extends Command {
  static description = 'Command to help with a workitem'

  static flags = {
    help: flags.help({char: 'h'})
  }

  static args = [{name: 'file'}]

  async run() {
    const {args, flags} = this.parse(WorkItem)


    SFPLogger.log(
      COLOR_HEADER(`sfp cli -- The DX@Scale Dev CLI -- ${this.config.version}`)
    );

    let topic = await this.promptAndCaptureWorkItem();

    if(topic === 'start')
    {
      let args=new Array<string>();
      args.push("inner");
      args.push("start");
      let workOn:Workon = new Workon(args,this.config);
      await workOn.run();
    }
    else if(topic === 'existing')
    {
      let args=new Array<string>();
      args.push("inner");
      args.push("existing");
      let workOn:Workon = new Workon(args,this.config);
      await workOn.run();
    }

  }


  private async promptAndCaptureWorkItem(): Promise<string> {
    const workItem = await inquirer.prompt([
      {
        type: "list",
        name: "topic",
        message: "Select an option to proceed?",
        choices: [
          { name: "Work on a new item ", value: "start" },
          { name: "Switch to an existing work item", value: "existing" },
          { name: "Submit a work item", value: "existing" },
        ],
        default: { name: "feat: A new feature", value: "feat" },
      },
    ]);

    return workItem.topic
  }
}
