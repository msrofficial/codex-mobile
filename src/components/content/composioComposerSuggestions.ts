import type { DirectoryComposioConnector, DirectoryComposioConnectorDetail } from '../../api/codexGateway'

export function mergeComposioConnectors(
  catalog: DirectoryComposioConnector[],
  liveRows: DirectoryComposioConnector[],
): DirectoryComposioConnector[] {
  const bySlug = new Map(liveRows.map((row) => [row.slug, row]))
  return catalog.map((row) => {
    const live = bySlug.get(row.slug)
    return live ? { ...row, ...live } : row
  })
}

function normalizeSuggestionQuery(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
}

export function getComposioSuggestionQuery(value: string): string {
  const beforeCursor = value.replace(/\s+$/u, '')
  const match = beforeCursor.match(/[a-z0-9][a-z0-9_-]*$/iu)
  return match?.[0]?.toLowerCase() ?? ''
}

export function removeComposioSuggestionQuery(value: string): string {
  return value.replace(/(?:^|\s+)[a-z0-9][a-z0-9_-]*\s*$/iu, '')
}

function scoreComposioSuggestion(connector: DirectoryComposioConnector, tokens: string[], fullQuery: string): number {
  const haystack = `${connector.name} ${connector.slug} ${connector.description}`.toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (connector.slug === token || connector.name.toLowerCase() === token) score += 500
    else if (connector.slug.startsWith(token) || connector.name.toLowerCase().startsWith(token)) score += 250
    else if (haystack.includes(token)) score += 100
  }
  if (fullQuery.includes(connector.slug.toLowerCase()) || fullQuery.includes(connector.name.toLowerCase())) score += 150
  if (score <= 0) return 0
  if (connector.activeCount > 0) score += 10_000
  else if (connector.totalConnections > 0) score += 2_500
  else if (connector.isNoAuth) score += 500
  score += connector.toolsCount
  return score
}

export function rankComposioSuggestions(rows: DirectoryComposioConnector[], query: string): DirectoryComposioConnector[] {
  const tokens = normalizeSuggestionQuery(query)
  if (tokens.length === 0) return []
  return rows
    .map((connector) => ({ connector, score: scoreComposioSuggestion(connector, tokens, query.toLowerCase()) }))
    .filter((row) => row.score > 0)
    .sort((first, second) => second.score - first.score || first.connector.name.localeCompare(second.connector.name))
    .map((row) => row.connector)
}

function sanitizeComposioFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    || 'connector'
}

function formatComposioList(items: string[]): string {
  const rows = items.map((item) => item.trim()).filter(Boolean)
  return rows.length > 0 ? rows.map((item) => `- ${item}`).join('\n') : '- None listed'
}

export function composioConnectorDocumentFileName(connector: DirectoryComposioConnector): string {
  return `composio-${sanitizeComposioFilePart(connector.slug || connector.name)}.md`
}

export function buildComposioConnectorDocument(
  connector: DirectoryComposioConnector,
  detail?: DirectoryComposioConnectorDetail | null,
): string {
  const resolvedConnector = detail?.connector ?? connector
  const connected = resolvedConnector.activeCount > 0
  const instruction = connected
    ? `Use the connected ${resolvedConnector.name} Composio connector (${resolvedConnector.slug}) for this request.`
    : `Use the ${resolvedConnector.name} Composio connector (${resolvedConnector.slug}) for this request.`
  const toolLines = (detail?.tools ?? []).map((tool) => {
    const description = tool.description.trim()
    return description ? `${tool.name} (${tool.slug}): ${description}` : `${tool.name} (${tool.slug})`
  })
  const connectionLines = (detail?.connections ?? []).map((connection) => {
    const status = connection.status ? `, status: ${connection.status}` : ''
    const alias = connection.alias ? `, alias: ${connection.alias}` : ''
    const authScheme = connection.authScheme ? `, auth: ${connection.authScheme}` : ''
    return `${connection.id || connection.wordId || 'connection'}${status}${alias}${authScheme}`
  })

  return [
    `# ${resolvedConnector.name} Composio Connector`,
    '',
    '## Instruction',
    instruction,
    '',
    '## Description',
    resolvedConnector.description.trim() || 'No connector description is available in the local Composio catalog.',
    '',
    '## Connector Metadata',
    `- Slug: ${resolvedConnector.slug}`,
    `- Tools: ${resolvedConnector.toolsCount}`,
    `- Triggers: ${resolvedConnector.triggersCount}`,
    `- Latest version: ${resolvedConnector.latestVersion || 'Not listed'}`,
    `- Auth modes: ${resolvedConnector.authModes.length > 0 ? resolvedConnector.authModes.join(', ') : 'Not listed'}`,
    `- No-auth connector: ${resolvedConnector.isNoAuth ? 'yes' : 'no'}`,
    `- Enabled: ${resolvedConnector.enabled ? 'yes' : 'no'}`,
    `- Active connections: ${resolvedConnector.activeCount}`,
    `- Total connections: ${resolvedConnector.totalConnections}`,
    `- Connection statuses: ${resolvedConnector.connectionStatuses.length > 0 ? resolvedConnector.connectionStatuses.join(', ') : 'None listed'}`,
    '',
    '## Available Tools',
    formatComposioList(toolLines),
    '',
    '## Connections',
    formatComposioList(connectionLines),
    '',
    '## Notes For Codex',
    '- Prefer this Composio connector when the user request matches the connector purpose above.',
    '- Use Composio connector tooling when it is available to inspect exact tool schemas before executing connector actions.',
    '- If authentication is required and no active connection is listed, ask the user to connect the connector before making authenticated calls.',
  ].join('\n')
}
