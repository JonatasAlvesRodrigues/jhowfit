# MOVELYA — contrato nativo de saúde

O frontend web nunca acessa HealthKit ou Health Connect diretamente. Um futuro shell nativo deve injetar `window.MovelyaHealthBridge` antes de carregar o React e implementar o contrato declarado em `src/types/healthIntegration.ts`.

## Mapeamento iOS / HealthKit

O target iOS precisa da capability HealthKit e de `NSHealthShareUsageDescription`. A integração é somente leitura.

| MOVELYA | HealthKit | Unidade normalizada | Identificador externo |
| --- | --- | --- | --- |
| `steps` | `HKQuantityTypeIdentifierStepCount` | `count` | `HKSample.uuid.uuidString` |
| `distance` | `HKQuantityTypeIdentifierDistanceWalkingRunning` e `HKQuantityTypeIdentifierDistanceCycling` | `km` | `HKSample.uuid.uuidString` |
| `workout` | `HKWorkoutType` | `seconds` | `HKWorkout.uuid.uuidString` |
| `active_calories` | `HKQuantityTypeIdentifierActiveEnergyBurned` | `kcal` | `HKSample.uuid.uuidString` |
| `weight` | `HKQuantityTypeIdentifierBodyMass` | `kg` | `HKSample.uuid.uuidString` |

Antes de qualquer operação, chamar `HKHealthStore.isHealthDataAvailable()`. Solicitar apenas os tipos habilitados pelo usuário com `requestAuthorization(toShare: [], read: types)`. O HealthKit não revela de forma inequívoca se a leitura de um tipo foi negada; uma consulta pode retornar zero registros.

Para sincronização incremental, usar `HKAnchoredObjectQuery` por tipo e manter os anchors somente no armazenamento protegido do app (Keychain). Registros alterados precisam preservar o UUID do HealthKit e atualizar `sourceUpdatedAt`.

## Mapeamento Android / Health Connect

O app Android precisa do SDK `androidx.health.connect`, das permissões de leitura correspondentes no manifesto e da declaração de tipos no Play Console.

| MOVELYA | Health Connect | Unidade normalizada | Identificador externo |
| --- | --- | --- | --- |
| `steps` | `StepsRecord` | `count` | `metadata.id` |
| `distance` | `DistanceRecord` | `km` | `metadata.id` |
| `workout` | `ExerciseSessionRecord` | `seconds` | `metadata.id` |
| `active_calories` | `ActiveCaloriesBurnedRecord` | `kcal` | `metadata.id` |
| `weight` | `WeightRecord` | `kg` | `metadata.id` |

No Android 14 ou superior, Health Connect é um módulo do sistema. No Android 13 ou inferior, o app Health Connect precisa estar instalado. Verificar a disponibilidade antes de solicitar permissões. Usar `PermissionController.createRequestPermissionResultContract()` e `getGrantedPermissions()`.

As alterações devem ser lidas com o Changes API quando disponível. O cursor/token permanece no armazenamento privado do app. Ao desconectar, o Android pode chamar `revokeAllPermissions()`; no iOS, o usuário revoga permissões no app Saúde.

## Contrato JavaScript

O shell nativo expõe quatro métodos assíncronos:

```ts
window.MovelyaHealthBridge = {
  getAvailability(): Promise<{
    available: boolean
    provider: 'apple_health' | 'health_connect' | null
    platform: 'ios' | 'android' | 'web'
    deviceLabel?: string
    reason?: string
  }>
  requestPermissions(input: {
    provider: 'apple_health' | 'health_connect'
    permissions: Array<'steps' | 'distance' | 'workout' | 'active_calories' | 'weight'>
  }): Promise<{ granted: string[] }>
  readRecords(input: {
    provider: 'apple_health' | 'health_connect'
    permissions: string[]
    since: string | null
  }): Promise<{ records: Array<{
    dataType: string
    externalId: string
    startedAt: string
    endedAt: string
    value: number
    unit: 'count' | 'km' | 'kcal' | 'kg' | 'seconds'
    sourceName?: string
    sourceUpdatedAt?: string
  }> }>
  disconnect(input: { provider: string }): Promise<void>
}
```

O shell deve rejeitar mensagens vindas de origens diferentes das URLs oficiais do MOVELYA. Nunca expor anchors, tokens ou APIs nativas genéricas ao JavaScript.

## Idempotência e privacidade

- A chave única é `(user_id, provider, data_type, external_id)`.
- A mesma janela de 48 horas é relida para absorver atualizações; `upsert` atualiza o registro em vez de duplicá-lo.
- Somente valores necessários são persistidos. Não armazenar payloads completos, coordenadas, nomes de dispositivos detalhados ou metadados clínicos.
- RLS limita conexões e registros ao usuário autenticado.
- A conexão é opcional; registro manual continua funcionando sem o bridge nativo.
- Desconectar interrompe novas leituras e preserva os registros já importados até que exista uma ação explícita de exclusão.

