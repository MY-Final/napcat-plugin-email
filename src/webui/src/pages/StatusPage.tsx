import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  IconX,
  IconEye,
  IconPaperclip
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

/** 格式化完整日期时间 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const sendTypeLabels: Record<string, { label: string; color: string; icon: React.ReactNode; bgColor: string }> = {
  scheduled: { 
    label: '定时任务', 
    color: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <IconCalendar size={14} />
  },
  manual: { 
    label: '手动发送', 
    color: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    icon: <IconSend size={14} />
  },
  test: { 
    label: '测试邮件', 
    color: 'text-gray-700 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
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
  const [selectedEmail, setSelectedEmail] = useState<EmailHistory | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
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

  // 查看邮件详情
  const viewEmailDetail = async (email: EmailHistory) => {
    try {
      const res = await noAuthFetch<EmailHistory>(`/email/history/${email.id}`)
      if (res.code === 0 && res.data) {
        setSelectedEmail(res.data)
        setShowDetailModal(true)
      } else {
        showToast('获取邮件详情失败', 'error')
      }
    } catch {
      showToast('获取邮件详情失败', 'error')
    }
  }

  // 删除单条记录
  const deleteRecord = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
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
                  onClick={() => viewEmailDetail(record)}
                  className="group flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${sendTypeLabels[record.sendType].bgColor} ${sendTypeLabels[record.sendType].color}`}>
                        {sendTypeLabels[record.sendType].icon}
                        {sendTypeLabels[record.sendType].label}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${record.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <span className="text-xs text-gray-400">{formatDate(record.sentAt)}</span>
                      {record.attachmentCount > 0 && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <IconPaperclip size={12} />
                          {record.attachmentCount}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {record.subject}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      收件人: {record.to}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        viewEmailDetail(record)
                      }}
                      className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="查看详情"
                    >
                      <IconEye size={16} />
                    </button>
                    <button
                      onClick={(e) => deleteRecord(e, record.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="删除记录"
                    >
                      <IconX size={16} />
                    </button>
                  </div>
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

      {/* 邮件详情弹窗 */}
      {showDetailModal && selectedEmail && (
        <EmailDetailModal 
          email={selectedEmail} 
          onClose={() => {
            setShowDetailModal(false)
            setSelectedEmail(null)
          }}
        />
      )}
    </div>
  )
}

/** 邮件详情弹窗组件 */
function EmailDetailModal({ email, onClose }: { email: EmailHistory; onClose: () => void }) {
  const [showHtml, setShowHtml] = useState(!!email.html)

  // 锁定 body 滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-[#1e1e20] rounded-2xl w-full max-w-3xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col shadow-2xl animate-modal-enter overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${sendTypeLabels[email.sendType].bgColor}`}>
              {sendTypeLabels[email.sendType].icon}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                邮件详情
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${sendTypeLabels[email.sendType].bgColor} ${sendTypeLabels[email.sendType].color}`}>
                {sendTypeLabels[email.sendType].label}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* 基本信息 */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem label="收件人" value={email.to} />
              <InfoItem label="发送时间" value={formatDateTime(email.sentAt)} />
            </div>
            <InfoItem label="主题" value={email.subject} />
            <div className="flex items-center gap-4">
              <InfoItem 
                label="发送状态" 
                value={
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                    email.status === 'success' 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${email.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {email.status === 'success' ? '发送成功' : '发送失败'}
                  </span>
                } 
              />
              {email.attachmentCount > 0 && (
                <InfoItem 
                  label="附件数量" 
                  value={
                    <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <IconPaperclip size={14} />
                      {email.attachmentCount} 个
                    </span>
                  } 
                />
              )}
            </div>
            {email.errorMessage && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">错误信息</div>
                <div className="text-sm text-red-700 dark:text-red-300">{email.errorMessage}</div>
              </div>
            )}
          </div>

          {/* 附件列表 */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <IconPaperclip size={16} />
                附件 ({email.attachments.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {email.attachments.map((att, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm"
                  >
                    <IconPaperclip size={14} className="text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">{att.filename}</span>
                    {att.contentType && (
                      <span className="text-xs text-gray-400">({att.contentType})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 邮件内容 */}
          {(email.text || email.html) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  邮件内容
                </h4>
                {email.text && email.html && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowHtml(false)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        !showHtml 
                          ? 'bg-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      纯文本
                    </button>
                    <button
                      onClick={() => setShowHtml(true)}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        showHtml 
                          ? 'bg-primary text-white' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-800">
                {showHtml && email.html ? (
                  <div 
                    className="prose dark:prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: email.html }}
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                    {email.text || '(无文本内容)'}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** 信息项组件 */
function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-sm text-gray-900 dark:text-white">{value}</div>
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
