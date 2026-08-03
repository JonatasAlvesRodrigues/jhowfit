export const formatNumber = (value: number) => value.toLocaleString('pt-BR')
export const formatPercent = (value: number, goal: number) => Math.round(value / goal * 100)
