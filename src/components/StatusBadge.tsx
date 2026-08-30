export type DealStage = 'Lead' | 'Proposal' | 'Negotiation' | 'Won' | 'Lost' | 'Dead' | 'Closed' | string
export type WorkStatus = 'Active' | 'Completed' | 'Pending' | 'Delayed' | string

type BadgeColors = { bg: string; text: string; dot: string }

const STAGE_COLORS: Record<string, BadgeColors> = {
  Lead:        { bg: '#E6F2FF', text: '#0052CC', dot: '#0052CC' },
  Proposal:    { bg: '#EAE6FF', text: '#403294', dot: '#6554C0' },
  Negotiation: { bg: '#FFF0E0', text: '#D97706', dot: '#FF8B00' },
  Won:         { bg: '#E3FCEF', text: '#006644', dot: '#36B37E' },
  Lost:        { bg: '#FFEBE6', text: '#DE350B', dot: '#FF5630' },
  Dead:        { bg: '#F4F5F7', text: '#6B778C', dot: '#97A0AF' },
  Closed:      { bg: '#F4F5F7', text: '#6B778C', dot: '#97A0AF' },
}

const STATUS_COLORS: Record<string, BadgeColors> = {
  Active:    { bg: '#E6F2FF', text: '#0052CC', dot: '#0052CC' },
  Completed: { bg: '#E3FCEF', text: '#006644', dot: '#36B37E' },
  Pending:   { bg: '#F4F5F7', text: '#6B778C', dot: '#97A0AF' },
  Delayed:   { bg: '#FFEBE6', text: '#DE350B', dot: '#FF5630' },
}

const DEFAULT_BADGE: BadgeColors = { bg: '#F4F5F7', text: '#6B778C', dot: '#97A0AF' }

export function StageBadge({ stage }: { stage: DealStage }) {
  const colors = STAGE_COLORS[stage] ?? DEFAULT_BADGE
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
      {stage}
    </span>
  )
}

export function StatusBadge({ status }: { status: WorkStatus }) {
  const colors = STATUS_COLORS[status] ?? DEFAULT_BADGE
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.dot }} />
      {status}
    </span>
  )
}

export function MissingBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium italic"
      style={{ backgroundColor: '#F4F5F7', color: '#97A0AF', border: '1px dashed #C1C7D0' }}
    >
      — Missing
    </span>
  )
}

export function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const map = {
    high:   { bg: '#E3FCEF', text: '#006644', dot: '#36B37E', label: 'High Confidence' },
    medium: { bg: '#FFF0E0', text: '#D97706', dot: '#FF8B00', label: 'Medium Confidence' },
    low:    { bg: '#FFEBE6', text: '#DE350B', dot: '#DE350B', label: 'Low Confidence' },
  }
  const c = map[level]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {c.label}
    </span>
  )
}
