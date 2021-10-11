import { SimpleGit } from "simple-git";
import { SfpProjectConfig } from "../../types/SfpProjectConfig";
import ProjectConfig from "@dxatscale/sfpowerscripts.core/lib/project/ProjectConfig";
import inquirer = require('inquirer')
import SFPLogger from "@dxatscale/sfpowerscripts.core/lib/logger/SFPLogger";
import { EOL } from "os";

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
      const message = await inquirer.prompt([
        {
          type: "input",
          name: "title",
          message: "Input commit title",
          validate: (input, answers) => {
            if (!input) return "Commit title cannot be empty";
            else return true;
          }
        },
        {
          type: "input",
          name: "body",
          message: "Input commit body",
          default: ""
        }
      ]);

      let commitMessage = message.title + EOL + EOL + message.body;

      const workItem = this.sfpProjectConfig.getWorkItemGivenBranch((await this.git.branch()).current);
      if (workItem) {
        // Prepend work item ID to commit messsage
        commitMessage = workItem.id + " " + commitMessage;
      }

      SFPLogger.log("Committing changes in package directories...");
      await this.git.commit(commitMessage, paths);
    }
  }
}