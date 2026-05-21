import * as tasks from "./tasks";
import * as queues from "./queues";
import * as executions from "./executions";
import * as settings from "./settings";
import * as stats from "./stats";
import * as focus from "./focus";
import * as achievements from "./achievements";
import * as subtasks from "./subtasks";
import * as dependencies from "./dependencies";
import * as links from "./links";
import * as knowledgePoints from "./knowledgePoints";
import * as analytics from "./analytics";

export const mobileSchedulerApi = {
  ...tasks,
  ...queues,
  ...executions,
  ...settings,
  ...stats,
  ...focus,
  ...achievements,
  ...subtasks,
  ...dependencies,
  ...links,
  ...knowledgePoints,
  ...analytics,
};
