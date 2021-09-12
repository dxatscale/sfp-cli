import { WorkItem } from "./WorkItem";

export class SfpProjectConfig {
  name?: string;
  defaultBranch?: string;
  defaultDevHub?: string;
  defaultPool?: string;
  workItems?: any;
  repoProvider?: string;

  public getWorkItemGivenBranch(branch: string): WorkItem {
    if (this.workItems) {
      for (const id of Object.keys(this.workItems)) {
        if (this.workItems[id]["branch"].toLowerCase() === branch.toLowerCase())
          return this.workItems[id];
      }
    } else return undefined;
  }

  static toInstance<T>(obj: T, jsonObj: any): T {
    for (var propName in jsonObj) {
      obj[propName] = jsonObj[propName];
    }
    return obj;
  }
}
