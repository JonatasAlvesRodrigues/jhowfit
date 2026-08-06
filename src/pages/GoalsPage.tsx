import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  Archive,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  Goal,
  History,
  Plus,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
  Utensils,
} from "lucide-react";
import { Button, Card, Field, Modal, Progress } from "../components/ui";
import {
  goalService,
  today,
  type GoalFrequency,
  type GoalProgressLog,
  type GoalStatus,
  type GoalType,
  type PersonalGoal,
  type PersonalGoalInput,
} from "../services/goalService";
import "../goals.css";

const typeOptions: Array<{
  type: GoalType;
  label: string;
  unit: string;
  icon: typeof Goal;
}> = [
  { type: "steps", label: "Passos", unit: "passos", icon: Footprints },
  { type: "workouts", label: "Treinos", unit: "treinos", icon: Dumbbell },
  { type: "water", label: "Água", unit: "litros", icon: Droplets },
  { type: "protein", label: "Proteína", unit: "g", icon: Utensils },
  { type: "calories", label: "Calorias", unit: "kcal", icon: Flame },
  { type: "weight", label: "Peso", unit: "kg", icon: Scale },
  { type: "walks", label: "Caminhadas", unit: "caminhadas", icon: Activity },
  {
    type: "active_minutes",
    label: "Minutos ativos",
    unit: "minutos",
    icon: Clock3,
  },
  {
    type: "active_days",
    label: "Dias ativos",
    unit: "dias",
    icon: CalendarDays,
  },
];
const frequencyLabels: Record<GoalFrequency, string> = {
  daily: "Diária",
  weekly: "Semanal",
  monthly: "Mensal",
};

export function GoalsPage({ userId }: { userId: string }) {
  const [goals, setGoals] = useState<PersonalGoal[]>([]);
  const [history, setHistory] = useState<GoalProgressLog[]>([]);
  const [tab, setTab] = useState<
    "active" | "completed" | "overdue" | "history"
  >("active");
  const [createOpen, setCreateOpen] = useState(false);
  const [progressGoal, setProgressGoal] = useState<PersonalGoal | null>(null);
  const [draft, setDraft] = useState<PersonalGoalInput>(() =>
    newGoal("steps", "daily"),
  );
  const [progressAmount, setProgressAmount] = useState("");
  const [progressDate, setProgressDate] = useState(today());
  const [progressNote, setProgressNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await goalService.list(userId);
      setGoals(data.goals);
      setHistory(data.history);
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [userId]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const active = goals.filter((goal) => goal.status === "active");
  const completed = goals.filter((goal) => goal.status === "completed");
  const overdue = goals.filter((goal) => goal.status === "overdue");
  const archived = goals.filter((goal) => goal.status === "archived");
  const overall = useMemo(() => {
    const considered = goals.filter((goal) => goal.status !== "archived");
    return considered.length
      ? Math.round(
          (considered.reduce(
            (sum, goal) =>
              sum + Math.min(goal.progressValue / goal.targetValue, 1),
            0,
          ) /
            considered.length) *
            100,
        )
      : 0;
  }, [goals]);
  const shown =
    tab === "active"
      ? active
      : tab === "completed"
        ? completed
        : tab === "overdue"
          ? overdue
          : [];

  function changeType(type: GoalType) {
    const option = typeOptions.find((item) => item.type === type)!;
    setDraft({
      ...draft,
      type,
      unit: option.unit,
      name: `Meta de ${option.label.toLowerCase()}`,
    });
  }
  function changeFrequency(frequency: GoalFrequency) {
    setDraft({ ...draft, frequency, ...datesFor(frequency, draft.startDate) });
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await goalService.create(userId, draft);
      setCreateOpen(false);
      setDraft(newGoal("steps", "daily"));
      setToast("Nova meta criada. Um passo claro de cada vez.");
      await load();
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setSaving(false);
    }
  }
  async function addProgress(event: FormEvent) {
    event.preventDefault();
    if (!progressGoal) return;
    setSaving(true);
    setError("");
    try {
      await goalService.addProgress(
        userId,
        progressGoal,
        Number(progressAmount),
        progressDate,
        progressNote,
      );
      setProgressGoal(null);
      setProgressAmount("");
      setProgressNote("");
      setToast(
        "Avanço registrado. Consistência também conta nos dias menores.",
      );
      await load();
    } catch (requestError) {
      setError(message(requestError));
    } finally {
      setSaving(false);
    }
  }
  async function archive(goal: PersonalGoal) {
    if (
      !window.confirm(
        "Mover esta meta para o histórico? O progresso continuará registrado.",
      )
    )
      return;
    try {
      await goalService.archive(userId, goal.id);
      setToast("Meta guardada no histórico.");
      await load();
    } catch (requestError) {
      setError(message(requestError));
    }
  }

  if (loading)
    return (
      <div className="goals-loading">
        <div />
        <div />
        <div />
        <div />
      </div>
    );
  return (
    <section className="goals-page">
      <div className="page-heading goals-hero">
        <div>
          <p>METAS PERSONALIZADAS</p>
          <h1>Progresso que cabe na sua rotina.</h1>
          <span>
            Defina objetivos realistas e ajuste o caminho sem cobranças
            desnecessárias.
          </span>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Criar meta
        </Button>
      </div>
      {error && (
        <div className="goals-alert is-error">
          <TriangleAlert size={17} />
          {error}
        </div>
      )}
      {toast && (
        <div className="goals-alert is-success">
          <Check size={17} />
          {toast}
        </div>
      )}

      <div className="goals-summary-grid">
        <Summary
          icon={<Target size={20} />}
          label="METAS ATIVAS"
          value={String(active.length)}
          caption="em andamento agora"
        />
        <Summary
          icon={<CheckCircle2 size={20} />}
          label="CONCLUÍDAS"
          value={String(completed.length)}
          caption="resultados celebrados"
        />
        <Summary
          icon={<Clock3 size={20} />}
          label="PERÍODOS ENCERRADOS"
          value={String(overdue.length)}
          caption="aprendizados para o próximo ciclo"
          tone="warm"
        />
        <Card className="goals-completion">
          <div
            className="goals-completion-ring"
            style={
              { "--goal-completion": `${overall}%` } as React.CSSProperties
            }
          >
            <span>
              <strong>{overall}%</strong>
              <small>CONCLUSÃO</small>
            </span>
          </div>
          <div>
            <small>PROGRESSO GERAL</small>
            <strong>
              {overall >= 80
                ? "Ritmo consistente"
                : overall >= 40
                  ? "Você está avançando"
                  : "Cada começo tem seu ritmo"}
            </strong>
            <p>Média das metas atuais e concluídas.</p>
          </div>
        </Card>
      </div>

      <div className="goals-tabs">
        <button
          className={tab === "active" ? "is-active" : ""}
          onClick={() => setTab("active")}
        >
          <Target size={15} /> Ativas <span>{active.length}</span>
        </button>
        <button
          className={tab === "completed" ? "is-active" : ""}
          onClick={() => setTab("completed")}
        >
          <CheckCircle2 size={15} /> Concluídas <span>{completed.length}</span>
        </button>
        <button
          className={tab === "overdue" ? "is-active" : ""}
          onClick={() => setTab("overdue")}
        >
          <Clock3 size={15} /> Período encerrado <span>{overdue.length}</span>
        </button>
        <button
          className={tab === "history" ? "is-active" : ""}
          onClick={() => setTab("history")}
        >
          <History size={15} /> Histórico
        </button>
      </div>

      {tab !== "history" ? (
        <div className="goals-grid">
          {shown.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onProgress={() => {
                setProgressGoal(goal);
                setProgressAmount("");
                setProgressDate(today());
                setProgressNote("");
              }}
              onArchive={() => void archive(goal)}
            />
          ))}
          {!shown.length && (
            <Empty status={tab} onCreate={() => setCreateOpen(true)} />
          )}
        </div>
      ) : (
        <div className="goals-history-layout">
          <Card className="goal-timeline">
            <header>
              <div>
                <small>REGISTROS DE PROGRESSO</small>
                <h2>Sua caminhada</h2>
              </div>
              <History size={19} />
            </header>
            <div>
              {history.map((log) => (
                <HistoryItem key={log.id} log={log} />
              ))}
              {!history.length && (
                <div className="goal-history-empty">
                  <Sparkles size={25} />
                  <strong>Seu histórico começa no primeiro avanço</strong>
                  <p>
                    Registre pequenas evoluções; elas ajudam a enxergar o que
                    funciona para você.
                  </p>
                </div>
              )}
            </div>
          </Card>
          <Card className="goal-archive">
            <header>
              <small>METAS ARQUIVADAS</small>
              <h2>Ciclos guardados</h2>
            </header>
            {archived.map((goal) => (
              <article key={goal.id}>
                <span>{typeIcon(goal.type, 16)}</span>
                <div>
                  <strong>{goal.name}</strong>
                  <small>
                    {formatNumber(goal.progressValue)} de{" "}
                    {formatNumber(goal.targetValue)} {goal.unit}
                  </small>
                </div>
                <b>{percentage(goal)}%</b>
              </article>
            ))}
            {!archived.length && (
              <p>
                Nenhuma meta arquivada. Quando um ciclo não fizer mais sentido,
                você poderá guardá-lo aqui sem perder o histórico.
              </p>
            )}
          </Card>
        </div>
      )}

      <div className="goals-kind-strip">
        {typeOptions.map((item) => (
          <span key={item.type}>
            {<item.icon size={15} />} {item.label}
          </span>
        ))}
      </div>

      {createOpen && (
        <Modal
          title="Criar meta personalizada"
          onClose={() => setCreateOpen(false)}
        >
          <form className="goal-form" onSubmit={create}>
            <div className="goal-type-grid">
              {typeOptions.map((item) => (
                <button
                  type="button"
                  key={item.type}
                  className={draft.type === item.type ? "is-selected" : ""}
                  onClick={() => changeType(item.type)}
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <Field
              required
              label="Nome da meta"
              maxLength={120}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
            />
            <div className="goal-form-grid">
              <Field
                required
                label="Valor desejado"
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                value={draft.targetValue || ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    targetValue: Number(event.target.value),
                  })
                }
              />
              <Field
                required
                label="Unidade"
                maxLength={30}
                value={draft.unit}
                onChange={(event) =>
                  setDraft({ ...draft, unit: event.target.value })
                }
              />
              <label className="goal-select-field">
                <span>Frequência</span>
                <select
                  value={draft.frequency}
                  onChange={(event) =>
                    changeFrequency(event.target.value as GoalFrequency)
                  }
                >
                  <option value="daily">Diária</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                </select>
              </label>
              <Field
                required
                label="Data inicial"
                type="date"
                value={draft.startDate}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    ...datesFor(draft.frequency, event.target.value),
                  })
                }
              />
              <Field
                required
                label="Data final"
                type="date"
                min={draft.startDate}
                value={draft.endDate}
                onChange={(event) =>
                  setDraft({ ...draft, endDate: event.target.value })
                }
              />
            </div>
            <p className="goal-form-note">
              <Sparkles size={15} /> Escolha uma meta que ajude sua rotina. Você
              poderá registrar o progresso no seu ritmo.
            </p>
            <div className="nutrition-modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Criando…" : "Criar meta"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {progressGoal && (
        <Modal title="Registrar avanço" onClose={() => setProgressGoal(null)}>
          <form className="goal-form" onSubmit={addProgress}>
            <div className="goal-progress-context">
              <span>{typeIcon(progressGoal.type, 20)}</span>
              <div>
                <small>{frequencyLabels[progressGoal.frequency]}</small>
                <strong>{progressGoal.name}</strong>
                <p>
                  {formatNumber(progressGoal.progressValue)} de{" "}
                  {formatNumber(progressGoal.targetValue)} {progressGoal.unit}
                </p>
              </div>
            </div>
            <div className="goal-form-grid two">
              <Field
                autoFocus
                required
                label={`Avanço em ${progressGoal.unit}`}
                type="number"
                min="0.01"
                max="10000000"
                step="0.01"
                value={progressAmount}
                onChange={(event) => setProgressAmount(event.target.value)}
              />
              <Field
                required
                label="Data"
                type="date"
                max={today()}
                value={progressDate}
                onChange={(event) => setProgressDate(event.target.value)}
              />
            </div>
            <label className="goal-note">
              <span>Observação opcional</span>
              <textarea
                maxLength={300}
                value={progressNote}
                onChange={(event) => setProgressNote(event.target.value)}
                placeholder="Como foi esse avanço?"
              />
            </label>
            <p className="goal-form-note">
              <TrendingUp size={15} /> Todo avanço válido entra no histórico,
              mesmo quando o período já terminou.
            </p>
            <div className="nutrition-modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setProgressGoal(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Registrando…" : "Registrar avanço"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

function GoalCard({
  goal,
  onProgress,
  onArchive,
}: {
  goal: PersonalGoal;
  onProgress: () => void;
  onArchive: () => void;
}) {
  const pct = percentage(goal);
  const content = statusContent(goal.status);
  return (
    <Card className={`goal-card is-${goal.status}`}>
      <header>
        <span>{typeIcon(goal.type, 19)}</span>
        <div>
          <small>
            {frequencyLabels[goal.frequency]} · {goalTypeLabel(goal.type)}
          </small>
          <h2>{goal.name}</h2>
        </div>
        <i>{content.label}</i>
      </header>
      <div className="goal-value">
        <strong>{formatNumber(goal.progressValue)}</strong>
        <span>
          / {formatNumber(goal.targetValue)} {goal.unit}
        </span>
        <b>{pct}%</b>
      </div>
      <Progress value={pct} />
      <p className="goal-motivation">{motivation(goal, pct)}</p>
      <div className="goal-dates">
        <span>
          <CalendarDays size={13} />
          {formatDate(goal.startDate)} — {formatDate(goal.endDate)}
        </span>
        <span>{content.detail}</span>
      </div>
      <footer>
        <Button onClick={onProgress}>
          <Plus size={14} /> Registrar avanço
        </Button>
        <Button variant="ghost" onClick={onArchive}>
          <Archive size={14} /> Arquivar
        </Button>
      </footer>
    </Card>
  );
}
function Summary({
  icon,
  label,
  value,
  caption,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  tone?: string;
}) {
  return (
    <Card className={`goal-summary ${tone ? "is-" + tone : ""}`}>
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <p>{caption}</p>
    </Card>
  );
}
function HistoryItem({ log }: { log: GoalProgressLog }) {
  return (
    <article>
      <span>
        <TrendingUp size={16} />
      </span>
      <div>
        <strong>
          +{formatNumber(log.amount)} {log.unit}
        </strong>
        <small>
          {log.goalName} · {formatDate(log.occurredOn)}
        </small>
        {log.note && <p>{log.note}</p>}
      </div>
    </article>
  );
}
function Empty({
  status,
  onCreate,
}: {
  status: "active" | "completed" | "overdue";
  onCreate: () => void;
}) {
  const copy =
    status === "active"
      ? [
          "Seu próximo objetivo começa aqui",
          "Crie uma meta possível para a rotina de agora.",
        ]
      : status === "completed"
        ? [
            "Resultados aparecerão aqui",
            "Metas concluídas serão guardadas para celebrar sua consistência.",
          ]
        : [
            "Nenhum período encerrado",
            "Suas metas atuais ainda têm tempo para evoluir.",
          ];
  return (
    <div className="goals-empty">
      <Goal size={32} />
      <strong>{copy[0]}</strong>
      <p>{copy[1]}</p>
      {status === "active" && (
        <Button onClick={onCreate}>
          <Plus size={15} /> Criar primeira meta
        </Button>
      )}
    </div>
  );
}
function statusContent(status: GoalStatus) {
  if (status === "completed")
    return { label: "Concluída", detail: "Objetivo alcançado" };
  if (status === "overdue")
    return {
      label: "Ciclo encerrado",
      detail: "Seu progresso continua válido",
    };
  return { label: "Em andamento", detail: "No seu ritmo" };
}
function motivation(goal: PersonalGoal, pct: number) {
  if (goal.status === "completed")
    return "Objetivo alcançado. Reconheça o caminho que trouxe você até aqui.";
  if (goal.status === "overdue")
    return `Você construiu ${pct}% deste caminho. Use esse resultado para ajustar o próximo ciclo.`;
  if (pct >= 75)
    return "Você está perto do objetivo. Mantenha o ritmo que funciona para você.";
  if (pct >= 35)
    return "Bom avanço. Consistência costuma ser mais útil que pressa.";
  return "Começar pequeno também é progresso. Siga com uma ação possível hoje.";
}
function percentage(goal: PersonalGoal) {
  return Math.min(
    Math.round((goal.progressValue / Math.max(goal.targetValue, 1)) * 100),
    100,
  );
}
function typeIcon(type: GoalType, size: number) {
  const Icon = typeOptions.find((item) => item.type === type)?.icon ?? Goal;
  return <Icon size={size} />;
}
function goalTypeLabel(type: GoalType) {
  return typeOptions.find((item) => item.type === type)?.label ?? "Meta";
}
function newGoal(type: GoalType, frequency: GoalFrequency): PersonalGoalInput {
  const option = typeOptions.find((item) => item.type === type)!;
  return {
    type,
    name: `Meta de ${option.label.toLowerCase()}`,
    targetValue: 0,
    unit: option.unit,
    frequency,
    ...datesFor(frequency, today()),
  };
}
function datesFor(frequency: GoalFrequency, startDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(start);
  if (frequency === "weekly") end.setDate(end.getDate() + 6);
  if (frequency === "monthly") end.setMonth(end.getMonth() + 1, 0);
  return { startDate, endDate: localDate(end) };
}
function localDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(`${date}T12:00:00`))
    .replace(".", "");
}
function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir esta ação.";
}
