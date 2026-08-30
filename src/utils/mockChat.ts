import { formatINR } from '../data/mockData'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metrics?: { label: string; value: string }[]
  insights?: string[]
  risks?: string[]
  actions?: string[]
  sources?: string[]
}

function makeId() {
  return Math.random().toString(36).slice(2)
}

type Pattern = {
  test: (s: string) => boolean
  respond: () => Omit<ChatMessage, 'id' | 'role' | 'timestamp'>
}

const patterns: Pattern[] = [
  {
    test: s => s.includes('energy') && (s.includes('pipeline') || s.includes('sector') || s.includes('quarter')),
    respond: () => ({
      content: `Energy has ${formatINR(153_000_000)} in open pipeline this quarter across 24 deals — the largest sector by value, more than double the next closest. Weighted pipeline stands at ${formatINR(76_500_000)}, though three opportunities have gone quiet for over a month, which mutes confidence.`,
      metrics: [
        { label: 'Pipeline', value: formatINR(153_000_000) },
        { label: 'Weighted', value: formatINR(76_500_000) },
        { label: 'Deals', value: '24' },
      ],
      insights: ['Energy represents 36% of open pipeline, concentrated with Rahul Menon.'],
      risks: ['Three opportunities have had no activity for 30+ days.'],
      actions: ["Review stalled Energy opportunities before Friday's pipeline sync."],
      sources: ['Deals (BI Agent) — 24 records'],
    }),
  },
  {
    test: s => (s.includes('pipeline') || s.includes('market cap') || s.includes('overall')) && !s.includes('energy'),
    respond: () => ({
      content: `Overall open pipeline is ${formatINR(420_000_000)} (${formatINR(187_000_000)} weighted). Energy leads at 36%, followed by Mining at 24%. Win rate is 31% this quarter with 84 active deals across five sectors.`,
      metrics: [
        { label: 'Open', value: formatINR(420_000_000) },
        { label: 'Weighted', value: formatINR(187_000_000) },
        { label: 'Active Deals', value: '84' },
      ],
      insights: ['Pipeline is sector-concentrated — Energy + Mining = 60% of total value.'],
      risks: ['4 deals are missing deal values, understating the true pipeline size.'],
      sources: ['Deals (BI Agent) — 84 records'],
    }),
  },
  {
    test: s => s.includes('revenue') || s.includes('won') || s.includes('win'),
    respond: () => ({
      content: `Won revenue this quarter is ${formatINR(92_000_000)}, up 8% vs last quarter. Win rate stands at 31%. The Canal Seepage Assessment (${formatINR(5_600_000)}) closed last week, contributing to the uptick.`,
      metrics: [
        { label: 'Won Revenue', value: formatINR(92_000_000) },
        { label: 'Win Rate', value: '31%' },
        { label: 'Deals Won', value: '9' },
      ],
      insights: ['Revenue growth trend is consistent — six consecutive months of increase.'],
      sources: ['Deals (BI Agent) — 9 Won records'],
    }),
  },
  {
    test: s => s.includes('operations') || s.includes('work order') || s.includes('delay') || s.includes('sla'),
    respond: () => ({
      content: `There are 126 work orders total: 42 active, 63 completed, 15 pending, and 6 delayed. Six projects are past SLA — Mining and Energy sectors are the primary bottlenecks. The most overdue is the Tailings Dam Volumetric Survey at 12 days past deadline.`,
      metrics: [
        { label: 'Total WOs', value: '126' },
        { label: 'Active', value: '42' },
        { label: 'Delayed', value: '6' },
      ],
      risks: ['Tailings Dam survey is 12 days overdue in Odisha.', 'Rooftop Solar Thermal Audit is 9 days overdue in Gujarat.'],
      actions: ['Escalate the two most overdue work orders in Mining and Energy.'],
      sources: ['Work Orders (BI Agent) — 126 records'],
    }),
  },
  {
    test: s => s.includes('mining'),
    respond: () => ({
      content: `Mining holds ${formatINR(100_800_000)} in open pipeline (24% of total) with the largest backlog value in operations. 34 work orders are in the Mining sector, of which 2 are currently delayed beyond SLA.`,
      metrics: [
        { label: 'Pipeline', value: formatINR(100_800_000) },
        { label: 'Work Orders', value: '34' },
        { label: 'Delayed', value: '2' },
      ],
      insights: ['Mining carries the highest operational backlog value despite fewer open deals than Energy.'],
      sources: ['Deals (BI Agent)', 'Work Orders (BI Agent)'],
    }),
  },
  {
    test: s => s.includes('health') || s.includes('risk') || s.includes('status'),
    respond: () => ({
      content: `Overall health score is 78/100 — rated Good. Primary risk flags are three stalled Energy deals (30+ days inactive), six work orders past SLA, and four deals with missing values that understate pipeline. No critical structural issues, but the stalled pipeline warrants immediate attention.`,
      metrics: [
        { label: 'Health Score', value: '78/100' },
        { label: 'Active Risks', value: '3' },
        { label: 'Data Gaps', value: '4' },
      ],
      risks: ['Stalled deals in Energy could represent up to ₹15 Cr at risk.'],
      actions: ['Address stalled deals and overdue SLAs before end of quarter.'],
      sources: ['Deals (BI Agent)', 'Work Orders (BI Agent)'],
    }),
  },
  {
    test: s => s.includes('leadership') || s.includes('brief') || s.includes('summary') || s.includes('update'),
    respond: () => ({
      content: `Here's a quick leadership summary: Pipeline at ${formatINR(420_000_000)} (weighted ${formatINR(187_000_000)}), won revenue ${formatINR(92_000_000)} at 31% win rate. Six work orders are overdue. Energy dominates at 36% of pipeline. Key action: review stalled Energy opportunities with Rahul Menon before Friday.`,
      metrics: [
        { label: 'Open Pipeline', value: formatINR(420_000_000) },
        { label: 'Won Revenue', value: formatINR(92_000_000) },
        { label: 'Delayed WOs', value: '6' },
      ],
      insights: ['Full leadership brief available in the Leadership tab with export-ready format.'],
      sources: ['Deals (BI Agent) — 84 records', 'Work Orders (BI Agent) — 126 records'],
    }),
  },
  {
    test: s => s.includes('sector') || s.includes('breakdown'),
    respond: () => ({
      content: `Sector breakdown of open pipeline: Energy 36% (₹15.1 Cr), Mining 24% (₹10.1 Cr), Infrastructure 22% (₹9.2 Cr), Agriculture 10% (₹4.2 Cr), Real Estate 8% (₹3.4 Cr). Energy's concentration is a key risk — over-dependence on one sector.`,
      metrics: [
        { label: 'Sectors', value: '5' },
        { label: 'Top Sector', value: 'Energy 36%' },
        { label: 'HHI Risk', value: 'Medium' },
      ],
      insights: ['Top two sectors (Energy + Mining) represent 60% of total pipeline value.'],
      sources: ['Deals (BI Agent) — 84 records'],
    }),
  },
]

const DEFAULT_RESPONSE: Omit<ChatMessage, 'id' | 'role' | 'timestamp'> = {
  content: `I can help you analyze your pipeline, operations, revenue, sector performance, or prepare leadership updates. Try asking: "How's our Energy pipeline this quarter?", "What's our win rate?", or "Which work orders are delayed?"`,
  insights: ['Connected to Deals (84 records) and Work Orders (126 records).'],
  sources: ['Deals (BI Agent)', 'Work Orders (BI Agent)'],
}

export async function generateChatResponse(userMessage: string): Promise<ChatMessage> {
  const lower = userMessage.toLowerCase()

  await new Promise(r => setTimeout(r, 1200 + Math.random() * 800))

  const matched = patterns.find(p => p.test(lower))
  const data = matched ? matched.respond() : DEFAULT_RESPONSE

  return {
    id: makeId(),
    role: 'assistant',
    timestamp: new Date(),
    ...data,
  }
}

export function createUserMessage(content: string): ChatMessage {
  return { id: makeId(), role: 'user', content, timestamp: new Date() }
}

export const STARTER_MESSAGES: ChatMessage[] = [
  createUserMessage("How's our pipeline looking for energy sector this quarter?"),
  {
    id: makeId(),
    role: 'assistant',
    timestamp: new Date(Date.now() - 60000),
    content: `Energy has ${formatINR(153_000_000)} in open pipeline this quarter across 24 deals — the largest sector by value, more than double the next closest. Weighted pipeline stands at ${formatINR(76_500_000)}, but three opportunities have gone quiet for over a month.`,
    metrics: [
      { label: 'Pipeline', value: formatINR(153_000_000) },
      { label: 'Weighted', value: formatINR(76_500_000) },
      { label: 'Deals', value: '24' },
    ],
    insights: ['Energy accounts for 36% of open pipeline.'],
    risks: ['Three Energy opportunities have had no activity for 30+ days.'],
    actions: ['Review stalled Energy opportunities with Rahul Menon.'],
    sources: ['Deals (BI Agent) — 24 records'],
  },
  createUserMessage("How is the market cap?"),
  {
    id: makeId(),
    role: 'assistant',
    timestamp: new Date(Date.now() - 30000),
    content: `Overall open pipeline is ${formatINR(420_000_000)} (${formatINR(187_000_000)} weighted). Energy leads at 36%, followed by Mining at 24%. Win rate is 31% with 84 active deals across five sectors.`,
    metrics: [
      { label: 'Open', value: formatINR(420_000_000) },
      { label: 'Weighted', value: formatINR(187_000_000) },
      { label: 'Active Deals', value: '84' },
    ],
    sources: ['Deals (BI Agent) — 84 records', 'Work Orders (BI Agent) — 126 records'],
  },
]
