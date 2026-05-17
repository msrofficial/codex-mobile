import { describe, expect, it } from 'vitest'
import type { DirectoryComposioConnector } from '../../api/codexGateway'
import {
  buildComposioConnectorDocument,
  composioConnectorDocumentFileName,
  getComposioSuggestionQuery,
  mergeComposioConnectors,
  rankComposioSuggestions,
  removeComposioSuggestionQuery,
} from './composioComposerSuggestions'

function connector(overrides: Partial<DirectoryComposioConnector>): DirectoryComposioConnector {
  return {
    slug: 'default',
    name: 'Default',
    description: '',
    logoUrl: '',
    latestVersion: '',
    toolsCount: 0,
    triggersCount: 0,
    isNoAuth: false,
    enabled: true,
    authModes: [],
    activeCount: 0,
    totalConnections: 0,
    connectionStatuses: [],
    ...overrides,
  }
}

describe('rankComposioSuggestions', () => {
  it('prefers connected connectors for matching text', () => {
    const rows = [
      connector({ slug: 'reddit', name: 'Reddit', activeCount: 1, toolsCount: 10 }),
      connector({ slug: 'reddit_org', name: 'Reddit Org', activeCount: 0, toolsCount: 50 }),
    ]
    expect(rankComposioSuggestions(rows, 'reddit')[0]?.slug).toBe('reddit')
  })

  it('returns empty results for too-short generic text', () => {
    expect(rankComposioSuggestions([connector({ slug: 'reddit', name: 'Reddit' })], 'r')).toEqual([])
  })
})

describe('getComposioSuggestionQuery', () => {
  it('uses only the current trailing connector word', () => {
    expect(getComposioSuggestionQuery('gmail calendar reddit')).toBe('reddit')
    expect(getComposioSuggestionQuery('gmail calendar reddit ')).toBe('reddit')
    expect(getComposioSuggestionQuery('use reddit, then gmail')).toBe('gmail')
  })

  it('removes the trailing connector word after selecting a suggestion', () => {
    expect(removeComposioSuggestionQuery('gmail calendar reddit')).toBe('gmail calendar')
    expect(removeComposioSuggestionQuery('gmail calendar reddit ')).toBe('gmail calendar')
    expect(removeComposioSuggestionQuery('reddit')).toBe('')
  })
})

describe('mergeComposioConnectors', () => {
  it('preserves catalog availability and overlays live fields by slug', () => {
    const merged = mergeComposioConnectors(
      [connector({ slug: 'reddit', name: 'Reddit', toolsCount: 12 })],
      [connector({ slug: 'reddit', name: 'Reddit', activeCount: 2, totalConnections: 2 })],
    )
    expect(merged[0]).toMatchObject({ slug: 'reddit', name: 'Reddit', activeCount: 2, totalConnections: 2 })
  })
})

describe('buildComposioConnectorDocument', () => {
  it('builds an attachment document with connector instructions and metadata', () => {
    const row = connector({
      slug: 'google-calendar',
      name: 'Google Calendar',
      description: 'Manage calendar events.',
      toolsCount: 3,
      activeCount: 1,
      authModes: ['OAUTH2'],
    })

    expect(composioConnectorDocumentFileName(row)).toBe('composio-google-calendar.md')
    expect(buildComposioConnectorDocument(row)).toContain('Use the connected Google Calendar Composio connector (google-calendar)')
    expect(buildComposioConnectorDocument(row)).toContain('Manage calendar events.')
    expect(buildComposioConnectorDocument(row)).toContain('- Auth modes: OAUTH2')
  })
})
