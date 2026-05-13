import type { DirectoryComposioConnector } from '../../api/codexGateway'

export type DirectorySortMode = 'popular' | 'name' | 'date'

const POPULAR_COMPOSIO_TOP_20: Array<[RegExp, number]> = [
  [/^gmail$/i, 20],
  [/^google calendar$/i, 19],
  [/^google drive$/i, 18],
  [/^reddit$/i, 17],
  [/^(x|twitter)$/i, 16],
  [/^youtube$/i, 15],
  [/^instagram$/i, 14],
  [/^tiktok$/i, 13],
  [/^facebook$/i, 12],
  [/^linkedin$/i, 11],
  [/^slack$/i, 10],
  [/^notion$/i, 9],
  [/^canva$/i, 8],
  [/^figma$/i, 7],
  [/^dropbox$/i, 6],
  [/^outlook$/i, 5],
  [/^(teams|microsoft teams)$/i, 4],
  [/^google docs$/i, 3],
  [/^google sheets$/i, 2],
  [/^spotify$/i, 1],
]
const POPULAR_COMPOSIO_NAME_BONUSES: Array<[RegExp, number]> = [
  [/(gmail|google calendar|google docs|google sheets|google drive|github|slack|notion|linear|outlook|supabase)/i, 140],
  [/(email|calendar|document|sheet|drive|repo|issue|message|project|database|crm|deploy)/i, 50],
]

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function bonusForName(name: string, rows: Array<[RegExp, number]>): number {
  return rows.reduce((score, [pattern, bonus]) => score + (pattern.test(name) ? bonus : 0), 0)
}

function normalizePopularRankName(name: string): string {
  return name
    .trim()
    .replace(/\s+\((synced|legacy)\)\s*$/iu, '')
    .replace(/\s+\(.*?\)\s*$/u, '')
    .replace(/[-_]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
}

function pinnedPopularRank(connector: DirectoryComposioConnector): number {
  const names = [connector.name, connector.slug].map(normalizePopularRankName)
  for (const name of names) {
    const match = POPULAR_COMPOSIO_TOP_20.find(([pattern]) => pattern.test(name))
    if (match) return match[1]
  }
  return 0
}

function composioPopularScore(connector: DirectoryComposioConnector): number {
  const pinnedRank = pinnedPopularRank(connector)
  if (pinnedRank > 0) return 1_000_000 + pinnedRank
  return (
    (connector.activeCount * 1_000) +
    (connector.isNoAuth ? 300 : 0) +
    (connector.toolsCount * 3) +
    (connector.triggersCount * 4) +
    bonusForName(`${connector.name} ${connector.slug} ${connector.description}`, POPULAR_COMPOSIO_NAME_BONUSES)
  )
}

function composioQueryScore(connector: DirectoryComposioConnector, query: string): number {
  const normalized = normalizeSearch(query)
  if (!normalized) return 0
  const name = connector.name.toLowerCase()
  const slug = connector.slug.toLowerCase()
  if (name === normalized || slug === normalized) return 1_000_000
  if (name.replace(/\s+/gu, '') === normalized.replace(/\s+/gu, '')) return 900_000
  if (name.startsWith(normalized) || slug.startsWith(normalized)) return 800_000
  if (name.includes(normalized) || slug.includes(normalized)) return 700_000
  return 0
}

function composioConnectionRank(connector: DirectoryComposioConnector): number {
  if (connector.activeCount > 0) return 0
  if (connector.totalConnections > 0) return 1
  if (connector.isNoAuth) return 2
  return 3
}

export function sortComposioConnectors(
  rows: DirectoryComposioConnector[],
  sortMode: DirectorySortMode,
  query = '',
): DirectoryComposioConnector[] {
  const normalizedQuery = normalizeSearch(query)
  const queryRank = (connector: DirectoryComposioConnector) => composioQueryScore(connector, normalizedQuery)
  if (sortMode === 'name') {
    return [...rows].sort((a, b) => (
      (queryRank(b) - queryRank(a)) ||
      (composioConnectionRank(a) - composioConnectionRank(b))
    ) || a.name.localeCompare(b.name))
  }
  if (sortMode === 'date') {
    return [...rows].sort((a, b) => (
      (queryRank(b) - queryRank(a)) ||
      (composioConnectionRank(a) - composioConnectionRank(b))
    ) || a.name.localeCompare(b.name))
  }
  return [...rows].sort((a, b) => (
    (queryRank(b) - queryRank(a)) ||
    (composioPopularScore(b) - composioPopularScore(a)) ||
    (composioConnectionRank(a) - composioConnectionRank(b)) ||
    a.name.localeCompare(b.name)
  ))
}
