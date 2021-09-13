import { WorkItem } from "../../types/WorkItem";
import { RepoProvider } from "./RepoProvider";

export default class Gitlab implements RepoProvider
{
  name(): string {
    return "gitlab"
  }

  isCLIInstalled(): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  getInstallationMessage(platform: string): string {
    throw new Error("Method not implemented.");
  }
  raiseAPullRequest(workItem: WorkItem) {
    throw new Error("Method not implemented.");
  }
  authenticate() {
    throw new Error("Method not implemented.");
  }

}