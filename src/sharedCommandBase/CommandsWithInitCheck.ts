import SfpCommand from "../SfpCommand";
import Init from "../commands/init";
import path = require("path");
import * as fs from "fs-extra";

export default abstract class CommandsWithInitCheck extends SfpCommand {

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
   return this.executeCommand();
  }


  protected abstract executeCommand(): Promise<any>;




}