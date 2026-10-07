export const fieldMap: Record<string, string> = {
  name: 'name',
  district: 'district',
  block: 'block',
  persona: 'persona',
  commitment_type: 'commitment_type',
  team_size: 'team_size',
  registration_status: 'registration_status',
  problem_solution: 'problem_solution',
  inspiration: 'inspiration',
  purpose: 'purpose',
  founder_proximity: 'founder_proximity',
  prior_venture_closed: 'prior_venture_closed',
  who_will_use: 'who_will_use',
  aspiration: 'aspiration',
  growth_ambition: 'growth_ambition',
  declared_stage: 'declared_stage',
  constraint: 'constraint',
  alternatives_today: 'alternatives_today',
  customers_spoken_to: 'customers_spoken_to',
  validation_done: 'validation_done',
  willingness_to_pay: 'willingness_to_pay',
  route_to_market: 'route_to_market',
  access_route: 'access_route',
  time_in_line: 'time_in_line',
  users_count: 'users_count',
  paying_customers: 'paying_customers',
  monthly_income: 'monthly_income',
  retention_signal: 'retention_signal',
  time_commitment: 'time_commitment',
  language: 'language',
}

export function assertAllMapped(headers: string[]) {
  const unmapped = headers.filter((h) => !fieldMap[h] && h !== '_expected')
  if (unmapped.length > 0) {
    throw new Error(`Unmapped columns found: ${unmapped.join(', ')}`)
  }
}
