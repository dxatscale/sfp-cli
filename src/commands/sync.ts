import {flags} from '@oclif/command'
import inquirer = require('inquirer')
import SFPLogger, { COLOR_HEADER } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import Pull from './pull';
import CommandsWithInitCheck from '../sharedCommandBase/CommandsWithInitCheck';


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


    }
    else if(option === 'sync-org')
    {
      let args=new Array<string>();
      args.push("inner");
      let pull:Pull= new Pull(args,this.config);
      await pull.run();

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
