import Command from "@oclif/command";
import { OutputArgs, OutputFlags } from '@oclif/parser';
import SFPlogger, {
  COLOR_HEADER,
  LoggerLevel
} from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export default abstract class SfpCommand extends Command {

  // The parsed flags for easy reference by this command; assigned in init
  protected flags: OutputFlags<any>;

  // The parsed args for easy reference by this command; assigned in init
  protected args: OutputArgs<any>;

  protected varargs?: any;

  // TypeScript does not yet have assertion-free polymorphic access to a class's static side from the instance side
  protected get statics() {
    return this.constructor as typeof SfpCommand;
  }

  public async _run<T>(): Promise<T> {
    await this.init();
    return await this.run();
  }

  protected async init(): Promise<void> {
    await super.init();

    const { args, flags, argv } = this.parse({
      flags: this.statics.flags,
      args: this.statics.args,
    });


    this.flags = flags;
    this.args = args;


    if (args.caller !== "inner") {
      SFPlogger.log(
        COLOR_HEADER(
          `sfp cli -- The DX@Scale Dev CLI -- ${this.config.version}`
        )
      );
    }

  }

  /**
   * Actual command run code goes here
   */
  public abstract run(): Promise<any>;



}