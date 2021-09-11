export class WorkItem
{
   id:string
   type:string
   branch?: string
   trackingBranch?:string
   defaultDevOrg?: string
   isActive?:boolean
   startCommitId?:string
   initiatedDate?:number
   lastModifiedDate?:number

   constructor(id:string)
   {
      this.id = id;
   }

}
