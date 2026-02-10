import { useState, useEffect, useCallback } from 'react'
import type { EmailHistory, EmailHistoryStats, EmailHistoryResponse } from '../types'
import { 
  IconPower, 
  IconClock, 
  IconActivity, 
  IconDownload,
  IconMail,
  IconCalendar,
  IconSend,
  IconTestTube,
  IconTrash,
  IconX
} from '../components/icons'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'

interface StatusPageProps {
  status: {
    uptime: number
    stats: {
      processed: number
      todayProcessed: number
    }
  } | null
}

/** 将毫秒格式化为可读时长 */
function formatUptime(uptimeMs: number): string {
  const seconds = Math.floor(uptimeMs / 1000)
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) return `${days}天 ${hours}小时 ${minutes}分 ${secs}秒`
  if (hours > 0) return `${hours}小时 ${minutes}分 ${secs}秒`
  if (minutes > 0) return `${minutes}分 ${secs}秒`
  return `${secs}秒`
}

/** 格式化日期 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const sendTypeLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  scheduled: { 
    label: '定时任务', 
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <IconCalendar size={14} />
  },
  manual: { 
    label: '手动发送', 
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: <IconSend size={14} />
  },
  test: { 
    label: '测试邮件', 
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    icon: <IconTestTube size={14} />
  },
}

export default function StatusPage({ status }: StatusPageProps) {
  const [displayUptime, setDisplayUptime] = useState<string>('-')
  const [syncInfo, setSyncInfo] = useState<{ baseUptime: number; syncTime: number } | null>(null)
  const [stats, setStats] = useState<{ total: EmailHistoryStats; today: EmailHistoryStats } | null>(null)
  const [history, setHistory] = useState<EmailHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // 同步运行时长
  useEffect(() => {
    if (status?.uptime !== undefined && status.uptime > 0) {
      setSyncInfo({ baseUptime: status.uptime, syncTime: Date.now() })
    }
  }, [status?.uptime])

  // 更新显示的运行时长
  useEffect(() => {
    if (!syncInfo) { setDisplayUptime('-'); return }
    const updateUptime = () => {
      const elapsed = Date.now() - syncInfo.syncTime
      setDisplayUptime(formatUptime(syncInfo.baseUptime + elapsed))
    }
    updateUptime()
    const interval = setInterval(updateUptime, 1000)
    return () => clearInterval(interval)
  }, [syncInfo])

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const res = await noAuthFetch<{ total: EmailHistoryStats; today: EmailHistoryStats }>('/email/stats')
      if (res.code === 0 && res.data) {
        setStats(res.data)
      }
    } catch {
      showToast('获取统计数据失败', 'error')
    }
  }, [])

  // 获取历史记录
  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await noAuthFetch<EmailHistoryResponse>(`/email/history?page=${page}&pageSize=${pageSize}`)
      if (res.code === 0 && res.data) {
        setHistory(res.data)
      }
    } catch {
      showToast('获取历史记录失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [page])

  // 删除单条记录
  const deleteRecord = async (id: string) => {
    if (!confirm('确定要删除这条记录吗？')) return
    try {
      const res = await noAuthFetch(`/email/history/${id}`, { method: 'DELETE' })
      if (res.code === 0) {
        showToast('删除成功', 'success')
        fetchHistory()
        fetchStats()
      } else {
        showToast(res.message || '删除失败', 'error')
      }
    } catch {
      showToast('删除失败', 'error')
    }
  }

  // 清空历史记录
  const clearHistory = async () => {
    if (!confirm('确定要清空所有历史记录吗？此操作不可恢复。')) return
    try {
      const res = await noAuthFetch('/email/history/clear', { method: 'POST' })
      if (res.code === 0) {
        showToast('历史记录已清空', 'success')
        fetchHistory()
        fetchStats()
      } else {
        showToast(res.message || '清空失败', 'error')
      }
    } catch {
      showToast('清空失败', 'error')
    }
  }

  // 初始加载和定时刷新
  useEffect(() => {
    fetchStats()
    fetchHistory()
    const interval = setInterval(() => {
      fetchStats()
      fetchHistory()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStats, fetchHistory])

  if (!status) {
    return (
      <div className="flex items-center justify-center h-64 empty-state">
        <div className="flex flex-col items-center gap-3">
          <div className="loading-spinner text-primary" />
          <div className="text-gray-400 text-sm">正在获取插件状态...</div>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: '插件状态',
      value: '运行中',
      icon: <IconPower size={18} />,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: '运行时长',
      value: displayUptime,
      icon: <IconClock size={18} />,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: '今日邮件',
      value: String(stats?.today.total || 0),
      icon: <IconActivity size={18} />,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: '累计邮件',
      value: String(stats?.total.total || 0),
      icon: <IconDownload size={18} />,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {statCards.map((card) => (
          <div key={card.label} className="card p-4 hover-lift">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 font-medium">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.bg} ${card.color} transition-transform duration-300 hover:scale-110`}>
                {card.icon}
              </div>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{card.value}</div>
          </div>
        ))}
      </div>

      {/* 邮件统计详情 */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 按类型统计 */}
          <div className="card p-5 hover-lift">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <IconMail size={16} className="text-gray-400" />
              发送类型分布
            </h3>
            <div className="space-y-3">
              <StatBar 
                label="定时任务" 
                value={stats.total.scheduled} 
                total={stats.total.total} 
                color="bg-blue-500"
              />
              <StatBar 
                label="手动发送" 
                value={stats.total.manual} 
                total={stats.total.total} 
                color="bg-purple-500"
              />
              <StatBar 
                label="测试邮件" 
                value={stats.total.test} 
                total={stats.total.total} 
                color="bg-gray-500"
              />
            </div>
          </div>

          {/* 按状态统计 */}
          <div className="card p-5 hover-lift">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <IconActivity size={16} className="text-gray-400" />
              发送状态统计
            </h3>
            <div className="space-y-3">
              <StatBar 
                label="成功" 
                value={stats.total.success} 
                total={stats.total.total} 
                color="bg-emerald-500"
              />
              <StatBar 
                label="失败" 
                value={stats.total.failed} 
                total={stats.total.total} 
                color="bg-red-500"
              />
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">成功率</span>
                <span className="font-medium text-emerald-600">
                  {stats.total.total > 0 
                    ? Math.round((stats.total.success / stats.total.total) * 100) 
                    : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* 今日统计 */}
          <div className="card p-5 hover-lift">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <IconCalendar size={16} className="text-gray-400" />
              今日发送概览
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.today.total}
                </div>
                <div className="text-xs text-gray-500 mt-1">总发送</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div className="text-2xl font-bold text-emerald-600">
                  {stats.today.success}
                </div>
                <div className="text-xs text-gray-500 mt-1">成功</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.today.scheduled}
                </div>
                <div className="text-xs text-gray-500 mt-1">定时</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {stats.today.manual}
                </div>
                <div className="text-xs text-gray-500 mt-1">手动</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 历史记录列表 */}
      <div className="card p-5 hover-lift">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <IconMail size={16} className="text-gray-400" />
            发送历史记录
          </h3>
          {history && history.total > 0 && (
            <button
              onClick={clearHistory}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <IconTrash size={14} />
              清空记录
            </button>
          )}
        </div>

        {loading && !history ? (
          <div className="flex items-center justify-center h-32">
            <div className="loading-spinner text-primary" />
          </div>
        ) : history?.list.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <IconMail size={48} className="mx-auto mb-3 opacity-30" />
            <p>暂无发送记录</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {history?.list.map((record) => (
                <div 
                  key={record.id} 
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${sendTypeLabels[record.sendType].color}`}>
                        {sendTypeLabels[record.sendType].icon}
                        {sendTypeLabels[record.sendType].label}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${record.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-gray-400">{formatDate(record.sentAt)}</span>
                      {record.attachmentCount > 0 && (
                        <span className="text-xs text-gray-400">
                          📎 {record.attachmentCount}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {record.subject}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      收件人: {record.to}
                    </div>
                    {record.errorMessage && (
                      <div className="text-xs text-red-500 mt-1">
                        错误: {record.errorMessage}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors ml-2"
                    title="删除记录"
                  >
                    <IconX size={16} />
                  </button>
                </div>
              ))}
            </div>

            {/* 分页 */}
            {history && history.total > pageSize && (
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="text-xs text-gray-500">
                  共 {history.total} 条记录
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    上一页
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    第 {page} / {Math.ceil(history.total / pageSize)} 页
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(history.total / pageSize), p + 1))}
                    disabled={page >= Math.ceil(history.total / pageSize)}
                    className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 disabled:opacity-50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** 统计条组件 */
function StatBar({ label, value, total, color }: { 
  label: string; 
  value: number; 
  total: number; 
  color: string 
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">{value}</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
