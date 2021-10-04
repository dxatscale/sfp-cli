import { SimpleGit } from "simple-git";
import { SfpProjectConfig } from "../../types/SfpProjectConfig";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import inquirer = require('inquirer')
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";

export default class CommitWorkflow {

  constructor(private git: SimpleGit, private sfpProjectConfig: SfpProjectConfig) {}

  async execute(): Promise<void> {
    const projectConfig = ProjectConfig.getSFDXPackageManifest(null);
    const paths = projectConfig.packageDirectories
      .filter((elem) => !elem.default)
      .map((elem) => elem.path);
    paths.push("sfdx-project.json");

    await this.git.add(paths);

    const isStagedChanges = await this.git.diff(["--staged", "--raw", "--", ...paths]) ? true : false;
    if (isStagedChanges) {
      const commitMessage = await inquirer.prompt({
        type: "editor",
        name: "message",
        message: "Input commit message",
        validate: (input, answers) => {
          if (!input) return "Commit message cannot be empty. Press <enter> to retry";
          else return true;
        }
      });

      const workItem = this.sfpProjectConfig.getWorkItemGivenBranch((await this.git.branch()).current);

      if (workItem) {
        // Append work item ID to commit messsage
        commitMessage.message += '\n' + workItem.id;
      }

      SFPLogger.log("Committing changes in package directories...");
      await this.git.commit(commitMessage.message, paths);
    }
  }
}