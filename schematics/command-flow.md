**sfp init** 
  

 - Initializes defaults by prompting for user (devhub, devpool, main branch)
 -  Future addition can include asking questions like Repo Provider (gh integration), ALM (jira)

**sfp workitem**

 - Helper commands to help with work items  
 -  WorkOn new item (cut a branch from default (prompt) , fetch/create a new dev org )  
 -  Swtich to existing item ( assuming you have the branch locally )   -
 -  Submit --> pull from repo , pre submit checks (pmd? package valid, dependency check). push to org (optional?),  commit and push  (future: gh pr create) <--- slow

  
  
**sfp sync**

  - Sync to/from Git ( you are not on the default  branch!!!, your branch could be shared by two devs) <-- main to local & push local
  - Sync to/from Org ( push/pull to the org)
  - Sort, Recommendations (static.. future dynamic) 
  
| Local Changes | Remote Changes  | Sync Direction  |
|--|--|--|
| X |  |Push|
|  | X |Pull|
|  |   |Both Conflict? -> Yes ask user, no conflict.. pull/push


