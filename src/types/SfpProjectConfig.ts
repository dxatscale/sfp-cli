import { WorkItem } from "./WorkItem";

export interface SfpProjectConfig{
  name?:string,
  defaultBranch?:string,
  defaultDevHub?:string,
  defaultPool?:string
  workItems?:any
}
