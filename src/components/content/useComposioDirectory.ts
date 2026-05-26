import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  getDirectoryComposioStatus,
  installDirectoryComposioCli,
  listDirectoryComposioConnectors,
  logoutDirectoryComposioCli,
  readDirectoryComposioConnector,
  startDirectoryComposioCliLogin,
  startDirectoryComposioLogin,
  uploadFile,
  type DirectoryComposioConnection,
  type DirectoryComposioConnector,
  type DirectoryComposioConnectorDetail,
  type DirectoryComposioStatus,
} from '../../api/codexGateway'
import { HARDCODED_COMPOSIO_CONNECTORS } from './composioConnectorCatalog'
import { mergeComposioConnectors, uploadComposioConnectorDocument } from './composioComposerSuggestions'
import { sortComposioConnectors, type DirectorySortMode } from './directoryHubUtils'

export const DEFAULT_COMPOSIO_DASHBOARD_URL = 'https://dashboard.composio.dev/'

const COMPOSIO_PAGE_LIMIT = 50
const COMPOSIO_AUTH_POLL_INTERVAL_MS = 2_000
const COMPOSIO_AUTH_POLL_TIMEOUT_MS = 120_000

type ComposioTryPayload = {
  kind: 'composio'
  name: string
  displayName: string
  prompt: string
  fileAttachments: Array<{ label: string; path: string; fsPath: string }>
}

type UseComposioDirectoryOptions = {
  activeTab: Ref<string>
  isTryActionInFlight: ComputedRef<boolean>
  getRouteConnectorSlug: () => string
  localAssetSrc: (path: string) => string
  openExternalUrl: (url: string) => void
  showToast: (text: string, type?: 'success' | 'error') => void
  emitTryItem: (payload: ComposioTryPayload) => void
}

function includesSearch(values: string[], query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return values.some((value) => value.toLowerCase().includes(normalized))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function openExternalUrlInNewTab(rawUrl: string): boolean {
  const url = rawUrl.trim()
  if (!/^https?:\/\//i.test(url)) return false
  const tab = window.open(url, '_blank', 'noopener,noreferrer')
  return Boolean(tab)
}

export function useComposioDirectory(options: UseComposioDirectoryOptions) {
  const composioStatus = ref<DirectoryComposioStatus | null>(null)
  const composioConnectors = ref<DirectoryComposioConnector[]>([])
  const composioNextCursor = ref<string | null>(null)
  const composioTotal = ref(0)
  const composioVisibleLimit = ref(COMPOSIO_PAGE_LIMIT)
  const composioSortMode = ref<DirectorySortMode>('popular')
  const composioSearchQuery = ref('')
  const isLoadingComposio = ref(false)
  const composioError = ref('')
  const lastRouteComposioConnectorSlug = ref('')
  const selectedComposioDetail = ref<DirectoryComposioConnectorDetail | null>(null)
  const isComposioDetailOpen = ref(false)
  const isLoadingComposioDetail = ref(false)
  const composioDetailError = ref('')
  const isInstallingComposio = ref(false)
  const isStartingComposioLogin = ref(false)
  const isLoggingOutComposio = ref(false)
  const composioActionSlug = ref('')
  const composioTryUploadSlug = ref('')

  const filteredComposioConnectors = computed(() =>
    sortComposioConnectors(
      composioConnectors.value.filter((connector) => includesSearch([
        connector.name,
        connector.slug,
        connector.description,
        ...connector.authModes,
        ...connector.connectionStatuses,
      ], composioSearchQuery.value)),
      composioSortMode.value,
      composioSearchQuery.value,
    ),
  )
  const visibleComposioConnectors = computed(() => filteredComposioConnectors.value.slice(0, composioVisibleLimit.value))
  const hasMoreComposioConnectors = computed(() =>
    visibleComposioConnectors.value.length < filteredComposioConnectors.value.length || composioNextCursor.value !== null,
  )
  const composioWorkspaceSummary = computed(() => {
    const status = composioStatus.value
    if (!status) return 'Composio CLI shares the login and connections from this machine.'
    const parts = [
      status.email || status.defaultOrgName,
      status.defaultOrgId ? `org ${status.defaultOrgId}` : '',
      status.baseUrl || '',
    ].filter(Boolean)
    return parts.join(' · ') || 'Composio CLI shares the login and connections from this machine.'
  })

  function composioLogoSrc(connector: DirectoryComposioConnector): string {
    return options.localAssetSrc(connector.logoUrl)
  }

  function composioMetaLabel(connector: DirectoryComposioConnector): string {
    if (connector.activeCount > 0) {
      return `${connector.activeCount} connected ${connector.activeCount === 1 ? 'account' : 'accounts'}`
    }
    if (connector.isNoAuth) return 'No auth required'
    if (connector.connectionStatuses.length > 0) return connector.connectionStatuses.join(', ')
    return connector.authModes.join(', ') || 'Connection required'
  }

  function composioHasUsableConnection(connector: DirectoryComposioConnector): boolean {
    return connector.isNoAuth || connector.activeCount > 0
  }

  function composioPrimaryActionLabel(connector: DirectoryComposioConnector): string {
    if (connector.isNoAuth) return ''
    if (connector.activeCount > 0) return 'Manage'
    if (connector.totalConnections > 0) return 'Reconnect'
    return 'Connect'
  }

  function composioConnectionStatusLabel(status: string): string {
    const normalized = status.trim().toUpperCase()
    if (normalized === 'ACTIVE') return 'Active'
    if (normalized === 'EXPIRED') return 'Expired'
    if (normalized === 'FAILED') return 'Failed'
    if (normalized === 'INITIATED') return 'Pending'
    return normalized || 'Unknown'
  }

  function composioConnectionStatusClass(status: string): string {
    const normalized = status.trim().toUpperCase()
    if (normalized === 'ACTIVE') return 'is-ok'
    if (normalized === 'INITIATED') return 'is-warning'
    if (normalized === 'EXPIRED' || normalized === 'FAILED') return 'is-error'
    return 'is-muted'
  }

  function buildLocalComposioDetail(
    connector: DirectoryComposioConnector,
    connections: DirectoryComposioConnection[] = [],
  ): DirectoryComposioConnectorDetail {
    return {
      connector,
      connections,
      tools: [],
      dashboardUrl: composioStatus.value?.webUrl || DEFAULT_COMPOSIO_DASHBOARD_URL,
    }
  }

  function resetComposioVisibleLimit(): void {
    composioVisibleLimit.value = COMPOSIO_PAGE_LIMIT
  }

  function composioTryKey(slug: string): string {
    return `composio:${slug}:`
  }

  function canTryComposio(connector: DirectoryComposioConnector): boolean {
    return composioHasUsableConnection(connector)
  }

  function buildComposioTryPrompt(connector: DirectoryComposioConnector, connections: DirectoryComposioConnection[] = []): string {
    const firstActive = connections.find((connection) => connection.status === 'ACTIVE' && !connection.isDisabled)
    const accountHint = firstActive?.wordId
      ? ` If there are multiple accounts, prefer \`${firstActive.wordId}\`.`
      : ''
    return `Use the attached ${connector.name} Composio connector documentation for this request. Start by listing what it can do here, mention the current connection status, and suggest one safe action I can run now.${accountHint}`
  }

  async function buildComposioTryAttachment(
    connector: DirectoryComposioConnector,
    connections: DirectoryComposioConnection[] = [],
  ): Promise<{ label: string; path: string; fsPath: string } | null> {
    let detail: DirectoryComposioConnectorDetail | null = null
    try {
      detail = await readDirectoryComposioConnector(connector.slug)
    } catch {
      detail = buildLocalComposioDetail(connector, connections)
    }

    return await uploadComposioConnectorDocument(connector, detail, uploadFile)
  }

  async function tryComposio(connector: DirectoryComposioConnector, connections: DirectoryComposioConnection[] = []): Promise<void> {
    if (options.isTryActionInFlight.value || composioTryUploadSlug.value) return
    composioTryUploadSlug.value = connector.slug
    let fileAttachment: { label: string; path: string; fsPath: string } | null = null
    try {
      fileAttachment = await buildComposioTryAttachment(connector, connections)
    } finally {
      composioTryUploadSlug.value = ''
    }
    if (!fileAttachment) {
      options.showToast(`Failed to attach ${connector.name} documentation.`, 'error')
      return
    }
    options.emitTryItem({
      kind: 'composio',
      name: connector.slug,
      displayName: connector.name,
      prompt: buildComposioTryPrompt(connector, connections),
      fileAttachments: [fileAttachment],
    })
  }

  async function loadComposio(): Promise<void> {
    isLoadingComposio.value = true
    composioError.value = ''
    try {
      const statusPromise = getDirectoryComposioStatus()
      const pagePromise = listDirectoryComposioConnectors('', null, COMPOSIO_PAGE_LIMIT)
        .then((page) => ({ page, error: null as Error | null }))
        .catch((error: unknown) => ({
          page: null,
          error: error instanceof Error ? error : new Error('Failed to load Composio connectors'),
        }))
      const status = await statusPromise
      composioStatus.value = status
      resetComposioVisibleLimit()
      if (!status.available || !status.authenticated) {
        composioConnectors.value = HARDCODED_COMPOSIO_CONNECTORS
        composioNextCursor.value = null
        composioTotal.value = HARDCODED_COMPOSIO_CONNECTORS.length
      } else {
        const { page, error } = await pagePromise
        if (error || !page) throw error ?? new Error('Failed to load Composio connectors')
        composioConnectors.value = mergeComposioConnectors(HARDCODED_COMPOSIO_CONNECTORS, page.data)
        composioNextCursor.value = page.nextCursor
        composioTotal.value = Math.max(page.total, composioConnectors.value.length)
      }
    } catch (error) {
      composioError.value = error instanceof Error ? error.message : 'Failed to load Composio connectors'
      composioConnectors.value = HARDCODED_COMPOSIO_CONNECTORS
      composioNextCursor.value = null
      composioTotal.value = HARDCODED_COMPOSIO_CONNECTORS.length
    } finally {
      isLoadingComposio.value = false
    }
    await openRouteComposioConnector()
  }

  async function loadMoreComposio(): Promise<void> {
    if (!hasMoreComposioConnectors.value) return
    if (!composioNextCursor.value) {
      composioVisibleLimit.value += COMPOSIO_PAGE_LIMIT
      return
    }
    if (!composioStatus.value?.available || !composioStatus.value.authenticated) return
    isLoadingComposio.value = true
    try {
      const page = await listDirectoryComposioConnectors('', composioNextCursor.value, COMPOSIO_PAGE_LIMIT)
      composioConnectors.value = mergeComposioConnectors(composioConnectors.value, page.data)
      composioNextCursor.value = page.nextCursor
      composioTotal.value = Math.max(page.total, composioConnectors.value.length)
      composioVisibleLimit.value += COMPOSIO_PAGE_LIMIT
    } catch (error) {
      composioError.value = error instanceof Error ? error.message : 'Failed to load more Composio connectors'
    } finally {
      isLoadingComposio.value = false
    }
  }

  async function openComposioDetail(slug: string): Promise<void> {
    isComposioDetailOpen.value = true
    isLoadingComposioDetail.value = true
    composioDetailError.value = ''
    selectedComposioDetail.value = null
    try {
      const local = composioConnectors.value.find((connector) => connector.slug === slug)
        ?? HARDCODED_COMPOSIO_CONNECTORS.find((connector) => connector.slug === slug)
      if (!composioStatus.value?.available || !composioStatus.value?.authenticated) {
        if (!local) throw new Error(`Unknown Composio connector: ${slug}`)
        selectedComposioDetail.value = buildLocalComposioDetail(local)
        return
      }
      selectedComposioDetail.value = await readDirectoryComposioConnector(slug)
    } catch (error) {
      composioDetailError.value = error instanceof Error ? error.message : 'Failed to load Composio connector'
    } finally {
      isLoadingComposioDetail.value = false
    }
  }

  function closeComposioDetail(): void {
    isComposioDetailOpen.value = false
  }

  function updateComposioConnectorRow(connector: DirectoryComposioConnector): void {
    composioConnectors.value = mergeComposioConnectors(composioConnectors.value, [connector])
    composioTotal.value = Math.max(composioTotal.value, composioConnectors.value.length)
  }

  async function openRouteComposioConnector(): Promise<void> {
    if (options.activeTab.value !== 'composio') return
    if (isLoadingComposio.value) return
    const slug = options.getRouteConnectorSlug()
    if (!slug || lastRouteComposioConnectorSlug.value === slug) return
    composioSearchQuery.value = slug
    await openComposioDetail(slug)
    lastRouteComposioConnectorSlug.value = slug
  }

  function resetRouteComposioConnectorSlug(): void {
    lastRouteComposioConnectorSlug.value = ''
  }

  async function startComposioConnect(connector: DirectoryComposioConnector): Promise<void> {
    composioActionSlug.value = connector.slug
    try {
      const result = await startDirectoryComposioLogin(connector.slug)
      if (!result.redirectUrl) {
        options.showToast(`No login URL returned for ${connector.name}`, 'error')
        return
      }
      if (!openExternalUrlInNewTab(result.redirectUrl)) {
        options.showToast(`Popup blocked. Allow popups to connect ${connector.name}.`, 'error')
        return
      }
      options.showToast(`Waiting for ${connector.name} connection...`)
      await waitForComposioConnectorConnection(connector.slug)
      options.showToast(`${connector.name} connected`)
    } catch (error) {
      options.showToast(error instanceof Error ? error.message : `Failed to connect ${connector.name}`, 'error')
    } finally {
      composioActionSlug.value = ''
    }
  }

  async function runComposioPrimaryAction(connector: DirectoryComposioConnector): Promise<void> {
    if (connector.activeCount > 0 && composioStatus.value?.webUrl) {
      options.openExternalUrl(composioStatus.value.webUrl)
      return
    }
    await startComposioConnect(connector)
  }

  async function startComposioCliLogin(): Promise<void> {
    isStartingComposioLogin.value = true
    const loginTab = window.open('about:blank', '_blank')
    if (loginTab) {
      loginTab.opener = null
    }
    try {
      const result = await startDirectoryComposioCliLogin()
      if (result.loginUrl && loginTab) {
        loginTab.location.href = result.loginUrl
      } else if (result.loginUrl) {
        options.showToast('Popup blocked. Allow popups to login to Composio.', 'error')
        return
      } else {
        loginTab?.close()
      }
      options.showToast('Waiting for Composio login...')
      await waitForComposioLogin()
      options.showToast('Composio CLI logged in')
    } catch (error) {
      loginTab?.close()
      options.showToast(error instanceof Error ? error.message : 'Failed to start Composio login', 'error')
    } finally {
      isStartingComposioLogin.value = false
    }
  }

  async function installComposioCli(): Promise<void> {
    isInstallingComposio.value = true
    try {
      await installDirectoryComposioCli()
      options.showToast('Composio CLI installed')
      await loadComposio()
    } catch (error) {
      options.showToast(error instanceof Error ? error.message : 'Failed to install Composio CLI', 'error')
    } finally {
      isInstallingComposio.value = false
    }
  }

  async function logoutComposioCli(): Promise<void> {
    isLoggingOutComposio.value = true
    try {
      await logoutDirectoryComposioCli()
      closeComposioDetail()
      options.showToast('Composio CLI logged out')
      await loadComposio()
    } catch (error) {
      options.showToast(error instanceof Error ? error.message : 'Failed to logout Composio CLI', 'error')
    } finally {
      isLoggingOutComposio.value = false
    }
  }

  async function waitForComposioLogin(): Promise<void> {
    const deadline = Date.now() + COMPOSIO_AUTH_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      const status = await getDirectoryComposioStatus(true)
      composioStatus.value = status
      if (status.available && status.authenticated) {
        await loadComposio()
        return
      }
      await sleep(COMPOSIO_AUTH_POLL_INTERVAL_MS)
    }
    await loadComposio()
    throw new Error('Timed out waiting for Composio login to complete')
  }

  async function waitForComposioConnectorConnection(slug: string): Promise<void> {
    const deadline = Date.now() + COMPOSIO_AUTH_POLL_TIMEOUT_MS
    while (Date.now() < deadline) {
      let connector = composioConnectors.value.find((row) => row.slug === slug)
      try {
        const detail = await readDirectoryComposioConnector(slug, true)
        connector = detail.connector
        updateComposioConnectorRow(detail.connector)
        if (isComposioDetailOpen.value && selectedComposioDetail.value?.connector.slug === slug) {
          selectedComposioDetail.value = detail
        }
      } catch {
        // Keep polling; the connector can fail until the external auth finishes.
      }
      if (connector && (connector.activeCount > 0 || connector.isNoAuth)) {
        await loadComposio()
        updateComposioConnectorRow(connector)
        return
      }
      await sleep(COMPOSIO_AUTH_POLL_INTERVAL_MS)
    }
    await loadComposio()
    throw new Error('Timed out waiting for Composio connector connection to complete')
  }

  return {
    DEFAULT_COMPOSIO_DASHBOARD_URL,
    composioStatus,
    composioConnectors,
    composioTotal,
    composioSortMode,
    composioSearchQuery,
    isLoadingComposio,
    composioError,
    selectedComposioDetail,
    isComposioDetailOpen,
    isLoadingComposioDetail,
    composioDetailError,
    isInstallingComposio,
    isStartingComposioLogin,
    isLoggingOutComposio,
    composioActionSlug,
    composioTryUploadSlug,
    visibleComposioConnectors,
    hasMoreComposioConnectors,
    composioWorkspaceSummary,
    composioLogoSrc,
    composioMetaLabel,
    composioPrimaryActionLabel,
    composioConnectionStatusLabel,
    composioConnectionStatusClass,
    resetComposioVisibleLimit,
    composioTryKey,
    canTryComposio,
    tryComposio,
    loadComposio,
    loadMoreComposio,
    openComposioDetail,
    closeComposioDetail,
    openRouteComposioConnector,
    resetRouteComposioConnectorSlug,
    runComposioPrimaryAction,
    startComposioCliLogin,
    installComposioCli,
    logoutComposioCli,
  }
}
