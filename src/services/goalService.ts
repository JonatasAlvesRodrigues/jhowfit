import { supabase } from "../integrations/supabase";

export type GoalType =
  | "steps"
  | "workouts"
  | "water"
  | "protein"
  | "calories"
  | "weight"
  | "walks"
  | "active_minutes"
  | "active_days";
export type GoalFrequency = "daily" | "weekly" | "monthly";
export type GoalStatus = "active" | "completed" | "overdue" | "archived";

export interface PersonalGoal {
  id: string;
  type: GoalType;
  name: string;
  targetValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  frequency: GoalFrequency;
  progressValue: number;
  status: GoalStatus;
  createdAt: string;
}

export interface PersonalGoalInput {
  type: GoalType;
  name: string;
  targetValue: number;
  unit: string;
  startDate: string;
  endDate: string;
  frequency: GoalFrequency;
}

export interface GoalProgressLog {
  id: string;
  goalId: string;
  goalName: string;
  unit: string;
  amount: number;
  occurredOn: string;
  note: string;
  createdAt: string;
}

export interface GoalData {
  goals: PersonalGoal[];
  history: GoalProgressLog[];
}

let localGoals: PersonalGoal[] = [];
let localLogs: GoalProgressLog[] = [];

export const goalService = {
  async list(userId: string): Promise<GoalData> {
    if (!supabase)
      return { goals: refreshStatuses(localGoals), history: [...localLogs] };
    const client = supabase;
    const [goalsResult, logsResult] = await Promise.all([
      client
        .from("personal_goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      client
        .from("goal_progress_logs")
        .select("id,goal_id,amount,occurred_on,note,created_at")
        .eq("user_id", userId)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    if (goalsResult.error || logsResult.error)
      throw new Error("Não foi possível carregar suas metas.");
    const goals = refreshStatuses((goalsResult.data ?? []).map(mapGoal));
    const updates = goals.filter(
      (goal) =>
        goal.status !==
        String(
          (goalsResult.data ?? []).find((row) => String(row.id) === goal.id)
            ?.status,
        ),
    );
    if (updates.length)
      await Promise.all(
        updates.map((goal) =>
          client
            .from("personal_goals")
            .update({
              status: goal.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", goal.id)
            .eq("user_id", userId),
        ),
      );
    const byId = new Map(goals.map((goal) => [goal.id, goal]));
    const history = (logsResult.data ?? []).map((row): GoalProgressLog => ({
      id: String(row.id),
      goalId: String(row.goal_id),
      goalName: byId.get(String(row.goal_id))?.name ?? "Meta",
      unit: byId.get(String(row.goal_id))?.unit ?? "",
      amount: Number(row.amount),
      occurredOn: String(row.occurred_on),
      note: String(row.note ?? ""),
      createdAt: String(row.created_at),
    }));
    return { goals, history };
  },

  async create(userId: string, input: PersonalGoalInput): Promise<void> {
    validateGoal(input);
    if (!supabase) {
      localGoals.unshift({
        id: `goal-${Date.now()}`,
        ...input,
        progressValue: 0,
        status: "active",
        createdAt: new Date().toISOString(),
      });
      return;
    }
    const { error } = await supabase
      .from("personal_goals")
      .insert({
        user_id: userId,
        type: input.type,
        name: input.name.trim(),
        target_value: input.targetValue,
        unit: input.unit.trim(),
        start_date: input.startDate,
        end_date: input.endDate,
        frequency: input.frequency,
        progress_value: 0,
        status: "active",
      });
    if (error) throw new Error("Não foi possível criar esta meta.");
  },

  async addProgress(
    userId: string,
    goal: PersonalGoal,
    amount: number,
    occurredOn: string,
    note: string,
  ): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000)
      throw new Error("Informe um avanço maior que zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || occurredOn > today())
      throw new Error("A data do avanço não pode estar no futuro.");
    if (note.length > 300)
      throw new Error("A observação deve ter até 300 caracteres.");
    if (!supabase) {
      localGoals = localGoals.map((item) =>
        item.id === goal.id
          ? {
              ...item,
              progressValue: item.progressValue + amount,
              status:
                item.progressValue + amount >= item.targetValue
                  ? "completed"
                  : item.status,
            }
          : item,
      );
      localLogs.unshift({
        id: `log-${Date.now()}`,
        goalId: goal.id,
        goalName: goal.name,
        unit: goal.unit,
        amount,
        occurredOn,
        note,
        createdAt: new Date().toISOString(),
      });
      return;
    }
    const { error } = await supabase.rpc("add_personal_goal_progress", {
      target_goal_id: goal.id,
      progress_amount: amount,
      progress_date: occurredOn,
      progress_note: note.trim(),
    });
    if (error) throw new Error("Não foi possível registrar este avanço.");
  },

  async archive(userId: string, goalId: string): Promise<void> {
    if (!supabase) {
      localGoals = localGoals.map((goal) =>
        goal.id === goalId ? { ...goal, status: "archived" } : goal,
      );
      return;
    }
    const { error } = await supabase
      .from("personal_goals")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", goalId)
      .eq("user_id", userId);
    if (error)
      throw new Error("Não foi possível mover esta meta para o histórico.");
  },
};

function mapGoal(row: Record<string, unknown>): PersonalGoal {
  return {
    id: String(row.id),
    type: String(row.type) as GoalType,
    name: String(row.name),
    targetValue: Number(row.target_value),
    unit: String(row.unit),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    frequency: String(row.frequency) as GoalFrequency,
    progressValue: Number(row.progress_value),
    status: String(row.status) as GoalStatus,
    createdAt: String(row.created_at),
  };
}

function refreshStatuses(goals: PersonalGoal[]) {
  const current = today();
  return goals.map((goal) => {
    if (goal.status === "archived") return goal;
    if (goal.progressValue >= goal.targetValue)
      return { ...goal, status: "completed" as const };
    if (goal.endDate < current) return { ...goal, status: "overdue" as const };
    return { ...goal, status: "active" as const };
  });
}

function validateGoal(input: PersonalGoalInput) {
  if (
    ![
      "steps",
      "workouts",
      "water",
      "protein",
      "calories",
      "weight",
      "walks",
      "active_minutes",
      "active_days",
    ].includes(input.type)
  )
    throw new Error("Selecione um tipo de meta válido.");
  if (input.name.trim().length < 2 || input.name.trim().length > 120)
    throw new Error("Dê um nome de 2 a 120 caracteres para sua meta.");
  if (
    !Number.isFinite(input.targetValue) ||
    input.targetValue <= 0 ||
    input.targetValue > 10000000
  )
    throw new Error("Informe um valor de meta maior que zero.");
  if (!input.unit.trim() || input.unit.trim().length > 30)
    throw new Error("Informe uma unidade válida.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) ||
    input.endDate < input.startDate
  )
    throw new Error("Confira as datas inicial e final.");
  if (!["daily", "weekly", "monthly"].includes(input.frequency))
    throw new Error("Selecione uma frequência válida.");
}

export function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
