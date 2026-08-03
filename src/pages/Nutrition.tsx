import { Beef, CirclePlus, Flame, Leaf, Wheat } from 'lucide-react'
import { Button, Card, Progress } from '../components/ui'
import type { Meal } from '../types'

export function Nutrition({ meals }: { meals: Meal[] }) {
  return <div className="page">
    <div className="page-heading"><div><p>DIÁRIO ALIMENTAR</p><h1>Nutrição</h1><span>Alimente o corpo que você quer construir.</span></div><Button><CirclePlus size={18}/> Adicionar refeição</Button></div>
    <div className="macro-grid">
      <Card className="macro"><span className="macro-icon protein"><Beef size={20}/></span><div><small>PROTEÍNAS</small><strong>112 <em>/ 160g</em></strong><Progress value={70}/></div></Card>
      <Card className="macro"><span className="macro-icon carbs"><Wheat size={20}/></span><div><small>CARBOIDRATOS</small><strong>138 <em>/ 240g</em></strong><Progress value={57} color="orange"/></div></Card>
      <Card className="macro"><span className="macro-icon fat"><Leaf size={20}/></span><div><small>GORDURAS</small><strong>42 <em>/ 70g</em></strong><Progress value={60} color="blue"/></div></Card>
    </div>
    <Card className="meals-card">
      <div className="section-heading"><div><small>HOJE</small><h3>Suas refeições</h3></div><span className="calorie-total"><Flame size={17}/> 1.240 kcal</span></div>
      <div className="meal-list">{meals.map(meal => <div className="meal-row" key={meal.id}><span className="meal-time">{meal.time}</span><div><strong>{meal.name}</strong><p>{meal.description}</p></div><b>{meal.calories} <small>kcal</small></b></div>)}</div>
    </Card>
  </div>
}
