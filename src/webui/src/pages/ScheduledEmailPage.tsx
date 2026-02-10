import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'
import { IconClock, IconPlus, IconEdit, IconTrash, IconPlay, IconX, IconCheck } from '../components/icons'

interface ScheduledEmail {
    id: string
    name: string
    to: string
    subject: string
    text?: string
    html?: string
    scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'interval'
    scheduledAt: string
    intervalMinutes?: number
    weekday?: number
    dayOfMonth?: number
    status: 'pending' | 'sent' | 'failed' | 'cancelled'
    createdAt: string
    lastSentAt?: string
    sendCount: number
    maxSendCount?: number | null
    errorMessage?: string
}

interface EmailAttachment {
    filename: string
    path?: string
    contentType?: string
}

const scheduleTypeLabels: Record<string, string> = {
    once: '一次性',
    daily: '每天',
    weekly: '每周',
    monthly: '每月',
    interval: '间隔',
}

const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: '待发送', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    sent: { label: '已完成', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    failed: { label: '失败', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
}

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function ScheduledEmailPage() {
    const [emails, setEmails] = useState<ScheduledEmail[]>([])
    const [loading, setLoading] = useState(false)
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        to: '',
        subject: '',
        text: '',
        html: '',
        scheduleType: 'once' as ScheduledEmail['scheduleType'],
        scheduledAt: '',
        intervalMinutes: 60,
        weekday: 1,
        dayOfMonth: 1,
        maxSendCount: null as number | null,
    })

    // 模态框打开时锁定 body 滚动
    useEffect(() => {
        if (showModal) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [showModal])

    const fetchEmails = useCallback(async () => {
        setLoading(true)
        try {
            const res = await noAuthFetch<ScheduledEmail[]>('/scheduled-emails')
            if (res.code === 0 && res.data) {
                setEmails(res.data)
            }
        } catch {
            showToast('获取定时邮件列表失败', 'error')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchEmails()
        const interval = setInterval(fetchEmails, 30000)
        return () => clearInterval(interval)
    }, [fetchEmails])

    const handleCreate = async () => {
        try {
            const res = await noAuthFetch('/scheduled-emails', {
                method: 'POST',
                body: JSON.stringify(formData),
            })
            if (res.code === 0) {
                showToast('创建成功', 'success')
                setShowModal(false)
                resetForm()
                fetchEmails()
            } else {
                showToast(res.message || '创建失败', 'error')
            }
        } catch {
            showToast('创建失败', 'error')
        }
    }

    const handleUpdate = async () => {
        if (!editingId) return
        try {
            const res = await noAuthFetch(`/scheduled-emails/${editingId}`, {
                method: 'PUT',
                body: JSON.stringify(formData),
            })
            if (res.code === 0) {
                showToast('更新成功', 'success')
                setShowModal(false)
                setEditingId(null)
                resetForm()
                fetchEmails()
            } else {
                showToast(res.message || '更新失败', 'error')
            }
        } catch {
            showToast('更新失败', 'error')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这个定时邮件任务吗？')) return
        try {
            const res = await noAuthFetch(`/scheduled-emails/${id}`, {
                method: 'DELETE',
            })
            if (res.code === 0) {
                showToast('删除成功', 'success')
                fetchEmails()
            } else {
                showToast(res.message || '删除失败', 'error')
            }
        } catch {
            showToast('删除失败', 'error')
        }
    }

    const handleExecute = async (id: string) => {
        try {
            const res = await noAuthFetch(`/scheduled-emails/${id}/execute`, {
                method: 'POST',
            })
            if (res.code === 0) {
                showToast('执行成功', 'success')
                fetchEmails()
            } else {
                showToast(res.message || '执行失败', 'error')
            }
        } catch {
            showToast('执行失败', 'error')
        }
    }

    const handleCancel = async (id: string) => {
        try {
            const res = await noAuthFetch(`/scheduled-emails/${id}/cancel`, {
                method: 'POST',
            })
            if (res.code === 0) {
                showToast('取消成功', 'success')
                fetchEmails()
            } else {
                showToast(res.message || '取消失败', 'error')
            }
        } catch {
            showToast('取消失败', 'error')
        }
    }

    const openCreateModal = () => {
        resetForm()
        setEditingId(null)
        setShowModal(true)
    }

    const openEditModal = (email: ScheduledEmail) => {
        setEditingId(email.id)
        setFormData({
            name: email.name,
            to: email.to,
            subject: email.subject,
            text: email.text || '',
            html: email.html || '',
            scheduleType: email.scheduleType,
            scheduledAt: formatDateTimeLocal(email.scheduledAt),
            intervalMinutes: email.intervalMinutes || 60,
            weekday: email.weekday ?? 1,
            dayOfMonth: email.dayOfMonth ?? 1,
            maxSendCount: email.maxSendCount ?? null,
        })
        setShowModal(true)
    }

    const resetForm = () => {
        setFormData({
            name: '',
            to: '',
            subject: '',
            text: '',
            html: '',
            scheduleType: 'once',
            scheduledAt: '',
            intervalMinutes: 60,
            weekday: 1,
            dayOfMonth: 1,
            maxSendCount: null,
        })
    }

    const formatDateTimeLocal = (isoString: string): string => {
        const date = new Date(isoString)
        return date.toISOString().slice(0, 16)
    }

    const formatDateTime = (isoString: string): string => {
        const date = new Date(isoString)
        return date.toLocaleString('zh-CN')
    }

    return (
        <div className="space-y-6 stagger-children">
            {/* 标题栏 */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">定时邮件任务</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">管理自动发送的定时邮件</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <IconPlus size={18} />
                    新建任务
                </button>
            </div>

            {/* 任务列表 */}
            {loading && emails.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                    <div className="loading-spinner text-primary" />
                </div>
            ) : emails.length === 0 ? (
                <div className="card p-8 text-center">
                    <div className="text-gray-400 dark:text-gray-500 mb-2">
                        <IconClock size={48} className="mx-auto opacity-50" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">暂无定时邮件任务</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">点击上方按钮创建第一个任务</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {emails.map((email) => (
                        <div key={email.id} className="card p-5 hover-lift">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                                            {email.name}
                                        </h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusLabels[email.status].color}`}>
                                            {statusLabels[email.status].label}
                                        </span>
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                            {scheduleTypeLabels[email.scheduleType]}
                                        </span>
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                        <p><span className="text-gray-400">收件人:</span> {email.to}</p>
                                        <p><span className="text-gray-400">主题:</span> {email.subject}</p>
                                        <p>
                                            <span className="text-gray-400">下次发送:</span>{' '}
                                            {email.status === 'pending' ? formatDateTime(email.scheduledAt) : '-'}
                                        </p>
                                        {email.sendCount > 0 && (
                                            <p>
                                                <span className="text-gray-400">已发送:</span>{' '}
                                                {email.sendCount} 次
                                                {email.maxSendCount ? ` / ${email.maxSendCount} 次` : ''}
                                                {email.lastSentAt && ` (${formatDateTime(email.lastSentAt)})`}
                                            </p>
                                        )}
                                        {email.errorMessage && (
                                            <p className="text-red-500 text-xs">{email.errorMessage}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {email.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleExecute(email.id)}
                                                className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                                title="立即执行"
                                            >
                                                <IconPlay size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleCancel(email.id)}
                                                className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                                                title="取消任务"
                                            >
                                                <IconX size={18} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => openEditModal(email)}
                                        className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="编辑"
                                    >
                                        <IconEdit size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(email.id)}
                                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="删除"
                                    >
                                        <IconTrash size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 创建/编辑模态框 - 使用 Portal 确保在最上层显示 */}
            {showModal && createPortal(
                <div 
                    className="fixed inset-0 bg-black/70 flex items-center justify-center p-2 sm:p-4 z-[9999]"
                    onClick={() => setShowModal(false)}
                >
                    <div 
                        className="bg-white dark:bg-[#1a1b1d] rounded-2xl w-full max-w-5xl max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col shadow-2xl animate-modal-enter overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 头部 */}
                        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                                {editingId ? '编辑定时邮件' : '新建定时邮件'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        {/* 可滚动内容区 */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 lg:gap-x-8 gap-y-5 lg:gap-y-6">
                                {/* 左列：基本信息 */}
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            任务名称 *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="input-field"
                                            placeholder="输入任务名称"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            收件人 *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.to}
                                            onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                                            className="input-field"
                                            placeholder="user@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            主题 *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            className="input-field"
                                            placeholder="邮件主题"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            邮件内容
                                        </label>
                                        <textarea
                                            value={formData.text}
                                            onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                                            className="input-field min-h-[200px] resize-y"
                                            placeholder="输入邮件正文（纯文本）"
                                        />
                                    </div>
                                </div>

                                {/* 右列：定时设置 */}
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            定时类型
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {(['once', 'daily', 'weekly', 'monthly', 'interval'] as const).map((type) => (
                                                <button
                                                    key={type}
                                                    onClick={() => setFormData({ ...formData, scheduleType: type })}
                                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                                        formData.scheduleType === type
                                                            ? 'bg-primary text-white'
                                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    {scheduleTypeLabels[type]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 根据类型显示不同的输入 */}
                                    {formData.scheduleType === 'once' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                发送时间 *
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={formData.scheduledAt}
                                                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                                className="input-field"
                                            />
                                        </div>
                                    )}

                                    {formData.scheduleType === 'interval' && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                    首次发送时间 *
                                                </label>
                                                <input
                                                    type="datetime-local"
                                                    value={formData.scheduledAt}
                                                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                                    className="input-field"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                    间隔时间（分钟）*
                                                </label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={formData.intervalMinutes}
                                                    onChange={(e) => setFormData({ ...formData, intervalMinutes: parseInt(e.target.value) || 60 })}
                                                    className="input-field"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {(formData.scheduleType === 'daily' || formData.scheduleType === 'weekly' || formData.scheduleType === 'monthly') && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                发送时间 *
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.scheduledAt ? new Date(formData.scheduledAt).toTimeString().slice(0, 5) : ''}
                                                onChange={(e) => {
                                                    const time = e.target.value
                                                    const now = new Date()
                                                    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${time}:00`
                                                    setFormData({ ...formData, scheduledAt: dateStr })
                                                }}
                                                className="input-field"
                                            />
                                        </div>
                                    )}

                                    {formData.scheduleType === 'weekly' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                星期几
                                            </label>
                                            <div className="flex flex-wrap gap-2">
                                                {weekdays.map((day, index) => (
                                                    <button
                                                        key={index}
                                                        onClick={() => setFormData({ ...formData, weekday: index })}
                                                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                            formData.weekday === index
                                                                ? 'bg-primary text-white'
                                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                                        }`}
                                                    >
                                                        {day}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {formData.scheduleType === 'monthly' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                                每月几号（1-31）
                                            </label>
                                            <input
                                                type="number"
                                                min={1}
                                                max={31}
                                                value={formData.dayOfMonth}
                                                onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) || 1 })}
                                                className="input-field"
                                            />
                                        </div>
                                    )}

                                    {/* 最大发送次数 */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                            最大发送次数（留空表示无限）
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={formData.maxSendCount ?? ''}
                                            onChange={(e) => {
                                                const val = e.target.value
                                                setFormData({ ...formData, maxSendCount: val ? parseInt(val) : null })
                                            }}
                                            className="input-field"
                                            placeholder="不限制"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 底部按钮 */}
                        <div className="flex justify-end gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1b1d] flex-shrink-0">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 sm:px-5 py-2 sm:py-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium text-sm sm:text-base"
                            >
                                取消
                            </button>
                            <button
                                onClick={editingId ? handleUpdate : handleCreate}
                                className="px-4 sm:px-5 py-2 sm:py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-medium text-sm sm:text-base"
                            >
                                <IconCheck size={16} />
                                {editingId ? '保存' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
