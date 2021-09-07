import {flags} from '@oclif/command'
import inquirer = require('inquirer')
import SFPLogger, { COLOR_HEADER } from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import SfpCommand from '../SfpCommand';

export default class Sync extends SfpCommand {
  static description = 'sync changes effortlessly either with repository or development environment'

  static flags = {
    help: flags.help({char: 'h'})
  }

  static args = [{name: 'file'}]

  async run() {

    SFPLogger.log(
      COLOR_HEADER(`sfp cli -- The DX@Scale Dev CLI -- ${this.config.version}`)
    );

    let option = await this.promptAndCaptureOption();

    if(option === 'Sync local with remote repository')
    {
      let args=new Array<string>();
      args.push("inner");
      args.push("start");

    }
    else if(option === 'Sync local with Dev Org')
    {
      let args=new Array<string>();
      args.push("inner");
      args.push("existing");

    }

  }


  private async promptAndCaptureOption(): Promise<string> {
    const optionPrompt = await inquirer.prompt([
      {
        type: "list",
        name: "option",
        message: "Select an option to proceed?",
        choices: [
          "Sync local with remote repository",
          "Sync local with Dev Org",
        ],
        default: "Sync local with remote repository"
      },
    ]);

    return optionPrompt.option;
  }
}
