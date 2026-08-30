export type Sector = 'Energy' | 'Mining' | 'Infrastructure' | 'Agriculture' | 'Real Estate'
export type DealStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost'
export type WorkStatus = 'Active' | 'Completed' | 'Pending' | 'Delayed'

export interface Deal {
  id: string
  name: string
  sector: Sector
  stage: DealStage
  value: number | null
  owner: string | null
  closeDate: string | null
  lastUpdated: string
}

export interface WorkOrder {
  id: string
  name: string
  sector: Sector
  status: WorkStatus
  value: number | null
  owner: string | null
  location: string
  startDate: string | null
  endDate: string | null
  overdueBy?: number
  lastUpdated: string
}

// INR amounts in raw rupees
export const DEALS: Deal[] = [
  { id: 'd1', name: 'Solar Farm Aerial Survey — NTPC Rewa', sector: 'Energy', stage: 'Negotiation', value: 18500000, owner: 'Rahul Menon', closeDate: '2026-09-12', lastUpdated: '2d ago' },
  { id: 'd2', name: 'Transmission Line Corridor Mapping', sector: 'Energy', stage: 'Qualified', value: 12800000, owner: 'Rahul Menon', closeDate: '2026-10-05', lastUpdated: '1d ago' },
  { id: 'd3', name: 'Wind Asset Inspection — Reflow', sector: 'Energy', stage: 'Proposal', value: null, owner: 'Rahul Menon', closeDate: '2026-09-30', lastUpdated: '2d ago' },
  { id: 'd4', name: 'Substation Thermal Survey', sector: 'Infrastructure', stage: 'Negotiation', value: 6400000, owner: 'Priya Nair', closeDate: null, lastUpdated: '2d ago' },
  { id: 'd5', name: 'Ash Pond Encroachment Study', sector: 'Mining', stage: 'Lost', value: 2900000, owner: 'Rahul Menon', closeDate: '2026-08-02', lastUpdated: '5d ago' },
  { id: 'd6', name: 'Open-cast Mine Volumetrics — Coal India', sector: 'Mining', stage: 'Proposal', value: 15200000, owner: 'Arjun Verma', closeDate: '2026-09-28', lastUpdated: '1d ago' },
  { id: 'd7', name: 'Quarry Compliance Mapping', sector: 'Mining', stage: 'Qualified', value: 4100000, owner: 'Arjun Verma', closeDate: '2026-10-12', lastUpdated: '2d ago' },
  { id: 'd8', name: 'Port Yard Stockpile Mapping', sector: 'Mining', stage: 'Lead', value: null, owner: 'Arjun Verma', closeDate: '2026-11-20', lastUpdated: '1d ago' },
  { id: 'd9', name: 'Highway Progress Monitoring — NHAI', sector: 'Infrastructure', stage: 'Negotiation', value: 11000000, owner: 'Priya Nair', closeDate: '2026-09-18', lastUpdated: '3d ago' },
  { id: 'd10', name: 'Crop Health Survey — 40,000 acres', sector: 'Agriculture', stage: 'Proposal', value: 8700000, owner: 'Sana Iyer', closeDate: '2026-10-01', lastUpdated: '1d ago' },
  { id: 'd11', name: 'Canal Seepage Assessment', sector: 'Agriculture', stage: 'Won', value: 5600000, owner: 'Sana Iyer', closeDate: '2026-08-14', lastUpdated: '4d ago' },
  { id: 'd12', name: 'Township Layout Verification', sector: 'Real Estate', stage: 'Lead', value: 3200000, owner: null, closeDate: '2026-11-02', lastUpdated: '1d ago' },
]

export const WORK_ORDERS: WorkOrder[] = [
  { id: 'w1', name: 'Tailings Dam Volumetric Survey', sector: 'Mining', status: 'Delayed', value: 8500000, owner: 'Arjun Verma', location: 'Mining - Odisha', startDate: '2026-07-01', endDate: '2026-08-15', overdueBy: 12, lastUpdated: '1d ago' },
  { id: 'w2', name: 'Rooftop Solar Thermal Audit — Batch 4', sector: 'Energy', status: 'Delayed', value: 4200000, owner: 'Rahul Menon', location: 'Energy - Gujarat', startDate: '2026-07-10', endDate: '2026-08-20', overdueBy: 9, lastUpdated: '2d ago' },
  { id: 'w3', name: 'Rail Corridor Encroachment Monitoring', sector: 'Infrastructure', status: 'Delayed', value: 6100000, owner: 'Priya Nair', location: 'Infrastructure - Maharashtra', startDate: '2026-07-15', endDate: '2026-08-22', overdueBy: 7, lastUpdated: '1d ago' },
  { id: 'w4', name: 'Post-monsoon Crop Damage Assessment', sector: 'Agriculture', status: 'Delayed', value: 3300000, owner: 'Sana Iyer', location: 'Agriculture - Punjab', startDate: '2026-08-01', endDate: '2026-08-25', overdueBy: 4, lastUpdated: '3d ago' },
  { id: 'w5', name: 'Coastal Erosion Baseline Survey', sector: 'Real Estate', status: 'Delayed', value: 2800000, owner: null, location: 'Real Estate - Tamil Nadu', startDate: '2026-07-25', endDate: '2026-08-24', overdueBy: 5, lastUpdated: '2d ago' },
  { id: 'w6', name: 'Wind Turbine Blade Inspection — Batch 7', sector: 'Energy', status: 'Active', value: 5600000, owner: 'Rahul Menon', location: 'Energy - Rajasthan', startDate: '2026-08-01', endDate: '2026-09-15', lastUpdated: '1d ago' },
  { id: 'w7', name: 'Coal Mine Boundary Demarcation', sector: 'Mining', status: 'Active', value: 4800000, owner: 'Arjun Verma', location: 'Mining - Jharkhand', startDate: '2026-08-05', endDate: '2026-09-20', lastUpdated: '2d ago' },
  { id: 'w8', name: 'NHAI Progress Scan — NH-48 Section', sector: 'Infrastructure', status: 'Completed', value: 7200000, owner: 'Priya Nair', location: 'Infrastructure - Karnataka', startDate: '2026-06-01', endDate: '2026-08-10', lastUpdated: '5d ago' },
  { id: 'w9', name: 'Paddy Field Crop Health Monitoring', sector: 'Agriculture', status: 'Completed', value: 2900000, owner: 'Sana Iyer', location: 'Agriculture - West Bengal', startDate: '2026-06-15', endDate: '2026-08-01', lastUpdated: '4d ago' },
  { id: 'w10', name: 'Solar Park Land Survey — Phase 2', sector: 'Energy', status: 'Pending', value: 9100000, owner: 'Rahul Menon', location: 'Energy - Andhra Pradesh', startDate: null, endDate: '2026-10-01', lastUpdated: '3d ago' },
  { id: 'w11', name: 'Port Infrastructure 3D Mapping', sector: 'Infrastructure', status: 'Active', value: 11200000, owner: 'Priya Nair', location: 'Infrastructure - Gujarat', startDate: '2026-08-10', endDate: '2026-09-30', lastUpdated: '1d ago' },
  { id: 'w12', name: 'Mango Orchard Canopy Assessment', sector: 'Agriculture', status: 'Completed', value: 1800000, owner: 'Sana Iyer', location: 'Agriculture - Maharashtra', startDate: '2026-07-01', endDate: '2026-08-05', lastUpdated: '6d ago' },
]

export const SECTOR_COLORS: Record<Sector, string> = {
  Energy: '#0052CC',
  Mining: '#FF8B00',
  Infrastructure: '#36B37E',
  Agriculture: '#6554C0',
  'Real Estate': '#FF5630',
}

export const SECTOR_PALETTE = ['#0052CC', '#FF8B00', '#36B37E', '#6554C0', '#FF5630']

export const STAGE_COLORS: Record<DealStage, { bg: string; text: string; dot: string }> = {
  Lead:        { bg: '#EAE6FF', text: '#403294', dot: '#6554C0' },
  Qualified:   { bg: '#E3FCEF', text: '#006644', dot: '#36B37E' },
  Proposal:    { bg: '#E6F2FF', text: '#0052CC', dot: '#0052CC' },
  Negotiation: { bg: '#FFF0E0', text: '#D97706', dot: '#FF8B00' },
  Won:         { bg: '#E3FCEF', text: '#006644', dot: '#00875A' },
  Lost:        { bg: '#FFEBE6', text: '#DE350B', dot: '#DE350B' },
}

export const STATUS_COLORS: Record<WorkStatus, { bg: string; text: string; dot: string }> = {
  Active:    { bg: '#E6F2FF', text: '#0052CC', dot: '#0052CC' },
  Completed: { bg: '#E3FCEF', text: '#006644', dot: '#36B37E' },
  Pending:   { bg: '#F4F5F7', text: '#6B778C', dot: '#97A0AF' },
  Delayed:   { bg: '#FFEBE6', text: '#DE350B', dot: '#DE350B' },
}

// Dashboard KPIs
export const DASHBOARD_DATA = {
  kpis: {
    openPipeline: 420000000,
    weightedPipeline: 187000000,
    wonRevenue: 92000000,
    winRate: 31,
    activeProjects: 42,
    delayedProjects: 6,
    healthScore: 78,
  },
  trends: {
    openPipeline: +14,
    weightedPipeline: +11,
    wonRevenue: +8,
    winRate: -2,
    activeProjects: +5,
    delayedProjects: -2,
  },
  revenueTrend: [
    { month: 'Mar', value: 1.3 },
    { month: 'Apr', value: 1.6 },
    { month: 'May', value: 1.8 },
    { month: 'Jun', value: 1.8 },
    { month: 'Jul', value: 1.9 },
    { month: 'Aug', value: 2.1 },
  ],
  sectorBreakdown: [
    { sector: 'Energy', value: 151200000, pct: 36 },
    { sector: 'Mining', value: 100800000, pct: 24 },
    { sector: 'Infrastructure', value: 92400000, pct: 22 },
    { sector: 'Agriculture', value: 42000000, pct: 10 },
    { sector: 'Real Estate', value: 33600000, pct: 8 },
  ],
  pipelineFunnel: [
    { stage: 'Lead',        value: 120000000, label: '12.0 Cr' },
    { stage: 'Qualified',   value: 95000000,  label: '9.5 Cr' },
    { stage: 'Proposal',    value: 89000000,  label: '8.9 Cr' },
    { stage: 'Negotiation', value: 18000000,  label: '1.8 Cr' },
    { stage: 'Won',         value: 92000000,  label: '9.2 Cr' },
  ],
  topRisks: [
    { title: '3 Energy opportunities inactive 30+ days', severity: 'high' as const },
    { title: '6 work orders past delivery SLA', severity: 'medium' as const },
    { title: '4 deals missing a deal value', severity: 'low' as const },
  ],
  dataQuality: {
    confidence: 'medium' as const,
    recordsAnalyzed: 248,
    excluded: 4,
    warnings: 6,
  },
  lastRefreshed: '10 min ago',
}

// Pipeline data
export const PIPELINE_DATA = {
  summary: {
    totalPipeline: 420000000,
    weightedPipeline: 187000000,
    activeDeals: 84,
    avgWinProbability: 44,
  },
  byStage: [
    { stage: 'Lead',        value: 120000000, label: '12.0 Cr' },
    { stage: 'Qualified',   value: 95000000,  label: '9.5 Cr' },
    { stage: 'Proposal',    value: 99000000,  label: '9.9 Cr' },
    { stage: 'Negotiation', value: 58000000,  label: '5.8 Cr' },
  ],
  byOwner: [
    { owner: 'Rahul Menon', value: 90000000, label: '9.00 Cr' },
    { owner: 'Priya Nair',  value: 44000000, label: '4.40 Cr' },
    { owner: 'Arjun Verma', value: 38000000, label: '3.80 Cr' },
    { owner: 'Sana Iyer',   value: 29000000, label: '2.90 Cr' },
    { owner: 'Unassigned',  value: 12000000, label: '1.20 Cr' },
  ],
  stalledDeals: [
    { name: 'Wind Asset Inspection — Reflow', owner: 'Rahul Menon', stage: 'Proposal' as DealStage, daysInactive: 41 },
    { name: 'Substation Thermal Survey', owner: 'Priya Nair', stage: 'Negotiation' as DealStage, daysInactive: 35 },
    { name: 'Quarry Compliance Mapping', owner: 'Arjun Verma', stage: 'Qualified' as DealStage, daysInactive: 32 },
  ],
}

// Operations data
export const OPERATIONS_DATA = {
  summary: {
    totalWorkOrders: 126,
    active: 42,
    completed: 63,
    pending: 15,
    delayed: 6,
    backlogValue: 125000000,
  },
  byStatus: [
    { status: 'Completed', count: 63, pct: 50 },
    { status: 'Active',    count: 42, pct: 33 },
    { status: 'Pending',   count: 15, pct: 12 },
    { status: 'Delayed',   count: 6,  pct: 5  },
  ],
  bySector: [
    { sector: 'Mining',         count: 34, value: 50000000 },
    { sector: 'Energy',         count: 29, value: 48000000 },
    { sector: 'Infrastructure', count: 24, value: 38000000 },
    { sector: 'Agriculture',    count: 18, value: 12000000 },
    { sector: 'Real Estate',    count: 10, value: 8000000  },
  ],
  dataQuality: {
    confidence: 'high' as const,
    recordsAnalyzed: 126,
    excluded: 0,
    warnings: 0,
  },
}

// Leadership brief data
export const LEADERSHIP_BRIEF = {
  generatedAt: new Date('2026-08-30T11:20:00Z'),
  headline: 'Open pipeline stays concentrated in Energy while work orders are running past their delivery window.',
  metrics: {
    openPipeline: 420000000,
    weightedPipeline: 187000000,
    wonRevenue: 92000000,
    winRate: 31,
    activeWorkOrders: 42,
    delayedWorkOrders: 6,
  },
  insights: [
    'Energy accounts for 36% of open pipeline value, more than double the next closest sector.',
    'Mining carries the largest operational backlog by value even though it has fewer open deals than Energy.',
  ],
  risks: [
    'Three Energy opportunities have had no logged activity for 30+ days.',
    'Six work orders are past their delivery SLA, four in Mining and Energy.',
    'Four deals are missing a deal value, which understates true pipeline size.',
  ],
  actions: [
    "Review the three stalled Energy opportunities with Rahul Menon before Friday's pipeline review.",
    'Reassign or escalate the two most overdue Mining work orders.',
    'Backfill missing deal values for the four flagged records to correct pipeline totals.',
  ],
  sources: [
    { board: 'Deals (BI Agent)', records: 84 },
    { board: 'Work Orders (BI Agent)', records: 126 },
  ],
  dataQuality: {
    recordsAnalyzed: 210,
    excluded: 6,
    confidence: 'medium' as const,
    warnings: ['6 records across both boards had missing or unparseable fields and were flagged.'],
  },
}

export function formatINR(amount: number): string {
  if (amount >= 10_000_000) {
    return `INR ${(amount / 10_000_000).toFixed(2)} Cr`
  }
  if (amount >= 100_000) {
    return `INR ${(amount / 100_000).toFixed(2)} L`
  }
  return `INR ${amount.toLocaleString('en-IN')}`
}

export function formatINRShort(amount: number): string {
  if (amount >= 10_000_000) {
    return `${(amount / 10_000_000).toFixed(2)} Cr`
  }
  if (amount >= 100_000) {
    return `${(amount / 100_000).toFixed(1)} L`
  }
  return amount.toLocaleString('en-IN')
}
