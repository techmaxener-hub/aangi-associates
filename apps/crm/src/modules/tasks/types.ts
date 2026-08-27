export type TaskStatus = "todo" | "in_progress" | "done";

export interface TaskAssignee {
  id: string;
  full_name: string | null;
  role: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  status: TaskStatus;
  linked_client_id: string | null;
  linked_candidate_id: string | null;
  created_by: string | null;
  created_at: string;
  assignee?: TaskAssignee | null;
}

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];
