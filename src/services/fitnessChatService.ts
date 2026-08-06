import { supabase } from '../integrations/supabase'
import type { MealSection } from '../types'
import type { AiConversation, AiMessage, FitnessAction, FitnessPermissions } from '../types/fitnessChat'
import { emptyFitnessPermissions } from '../types/fitnessChat'
import { nutritionService } from './nutritionService'

const mealSections: MealSection[] = ['Café da manhã','Lanche da manhã','Almoço','Lanche da tarde','Jantar','Ceia','Outras refeições']

export const fitnessChatService = {
  async listConversations(userId: string): Promise<AiConversation[]> {
    requireClient()
    const { data, error } = await supabase!.from('ai_conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
    if (error) throw new Error('Não foi possível carregar suas conversas.')
    return (data ?? []).map(mapConversation)
  },
  async createConversation(userId: string, title: string, permissions: FitnessPermissions): Promise<AiConversation> {
    requireClient()
    const { data, error } = await supabase!.from('ai_conversations').insert({ user_id: userId, title: title.trim().slice(0, 120) || 'Nova conversa', permissions }).select('*').single()
    if (error || !data) throw new Error('Não foi possível iniciar a conversa.')
    return mapConversation(data)
  },
  async updatePermissions(userId: string, conversationId: string, permissions: FitnessPermissions) {
    requireClient()
    const { error } = await supabase!.from('ai_conversations').update({ permissions, updated_at: new Date().toISOString() }).eq('id', conversationId).eq('user_id', userId)
    if (error) throw new Error('Não foi possível atualizar as permissões.')
  },
  async listMessages(userId: string, conversationId: string): Promise<AiMessage[]> {
    requireClient()
    const { data, error } = await supabase!.from('ai_messages').select('*').eq('user_id', userId).eq('conversation_id', conversationId).order('created_at')
    if (error) throw new Error('Não foi possível abrir esta conversa.')
    return (data ?? []).map(mapMessage)
  },
  async send(conversationId: string, message: string): Promise<{ userMessage: AiMessage; assistantMessage: AiMessage }> {
    requireClient()
    const { data, error } = await supabase!.functions.invoke('fitness-chat', { body: { conversationId, message } })
    if (error) { const context = (error as { context?: Response }).context; const response = context ? await context.clone().json().catch(() => null) : null; throw new Error(response?.error || 'Não foi possível falar com o assistente.') }
    if (!data?.userMessage || !data?.assistantMessage) throw new Error(data?.error || 'A IA não retornou uma resposta válida.')
    return { userMessage: mapMessage(data.userMessage), assistantMessage: mapMessage(data.assistantMessage) }
  },
  async clearConversation(userId: string, conversationId: string) {
    requireClient()
    const { error } = await supabase!.from('ai_messages').delete().eq('user_id', userId).eq('conversation_id', conversationId)
    if (error) throw new Error('Não foi possível limpar o histórico.')
  },
  async deleteConversation(userId: string, conversationId: string) {
    requireClient()
    const { error } = await supabase!.from('ai_conversations').delete().eq('user_id', userId).eq('id', conversationId)
    if (error) throw new Error('Não foi possível excluir a conversa.')
  },
  async dismissAction(userId: string, messageId: string) { await setActionStatus(userId, messageId, 'dismissed') },
  async applyAction(userId: string, messageId: string, action: FitnessAction) {
    requireClient()
    const payload = action.payload
    if (action.type === 'exercise_substitution') {
      const exerciseId = requiredText(payload.exerciseId), replacement = requiredText(payload.replacement)
      const { error } = await supabase!.from('exercises').update({ name: replacement.slice(0,120), updated_at: new Date().toISOString() }).eq('id', exerciseId).eq('user_id', userId)
      if (error) throw new Error('Não foi possível substituir o exercício.')
    } else if (action.type === 'workout_change') {
      const workoutId = requiredText(payload.workoutId), title = requiredText(payload.title), duration = clamp(Number(payload.duration), 10, 180)
      const scheduledDays = Array.isArray(payload.scheduledDays) ? payload.scheduledDays.map(String).slice(0,7) : []
      const exercises = Array.isArray(payload.exercises) ? payload.exercises.slice(0,12).map((item,index) => { const exercise = item as Record<string,unknown>; return { user_id:userId,workout_id:workoutId,name:requiredText(exercise.name).slice(0,120),position:index,sets_count:clamp(Number(exercise.sets),1,10),repetitions_text:String(exercise.repetitions||'8-12').slice(0,40),rest_seconds:clamp(Number(exercise.restSeconds),0,300),notes:null,is_optional:false,advanced_technique:'',substitutions:[] } }) : []
      if (!exercises.length) throw new Error('A sugestão de treino não possui exercícios suficientes.')
      const { error } = await supabase!.from('workouts').update({ title: title.slice(0,120), focus:String(payload.focus||'').slice(0,180),duration,exercise_count:exercises.length,scheduled_days:scheduledDays,updated_at:new Date().toISOString() }).eq('id', workoutId).eq('user_id', userId)
      if (error) throw new Error('Não foi possível alterar o treino.')
      const { error:deleteError } = await supabase!.from('exercises').delete().eq('workout_id',workoutId).eq('user_id',userId)
      if (deleteError) throw new Error('O treino foi atualizado, mas os exercícios anteriores não puderam ser substituídos.')
      const { error:insertError } = await supabase!.from('exercises').insert(exercises)
      if (insertError) throw new Error('O treino foi atualizado, mas os novos exercícios não puderam ser salvos.')
    } else if (action.type === 'new_meal') {
      const section = mealSections.includes(String(payload.mealSection) as MealSection) ? String(payload.mealSection) as MealSection : 'Outras refeições'
      await nutritionService.addMealEntry(userId, { mealSection: section, name: requiredText(payload.name).slice(0,160), quantity: positive(payload.quantity,1), unit: String(payload.unit || 'porção').slice(0,30), calories: nonNegative(payload.calories), protein: nonNegative(payload.protein), carbs: nonNegative(payload.carbs), fat: nonNegative(payload.fat), fiber: 0, sodium: 0, time: String(payload.time || '19:00').slice(0,5), notes: String(payload.notes || '').slice(0,300), sourceType: 'custom', date: validDate(payload.date) })
    } else if (action.type === 'goal_adjustment') {
      const goalId = requiredText(payload.goalId), targetValue = positive(payload.targetValue, 1), endDate = validDate(payload.endDate)
      const { error } = await supabase!.from('personal_goals').update({ target_value: targetValue, end_date: endDate, updated_at: new Date().toISOString() }).eq('id', goalId).eq('user_id', userId)
      if (error) throw new Error('Não foi possível ajustar a meta.')
    }
    await setActionStatus(userId, messageId, 'confirmed')
  },
}

function mapConversation(row: Record<string, unknown>): AiConversation { return { id: String(row.id), title: String(row.title), permissions: { ...emptyFitnessPermissions, ...(row.permissions as Partial<FitnessPermissions> ?? {}) }, createdAt: String(row.created_at), updatedAt: String(row.updated_at) } }
function mapMessage(row: Record<string, unknown>): AiMessage { return { id: String(row.id), conversationId: String(row.conversation_id), role: String(row.role) as AiMessage['role'], content: String(row.content), action: row.action ? row.action as unknown as FitnessAction : null, actionStatus: row.action_status ? String(row.action_status) as AiMessage['actionStatus'] : null, createdAt: String(row.created_at) } }
async function setActionStatus(userId: string, messageId: string, status: 'confirmed' | 'dismissed') { requireClient(); const { error } = await supabase!.from('ai_messages').update({ action_status: status }).eq('id', messageId).eq('user_id', userId); if (error) throw new Error('Não foi possível atualizar esta sugestão.') }
function requireClient() { if (!supabase) throw new Error('A conexão com o Supabase não está configurada.') }
function requiredText(value: unknown) { const text = String(value ?? '').trim(); if (!text) throw new Error('A sugestão não possui os dados necessários.'); return text }
function clamp(value: number, min: number, max: number) { return Math.min(Math.max(Number.isFinite(value) ? Math.round(value) : min, min), max) }
function positive(value: unknown, fallback: number) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback }
function nonNegative(value: unknown) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? number : 0 }
function validDate(value: unknown) { const text = String(value ?? ''); return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0,10) }
