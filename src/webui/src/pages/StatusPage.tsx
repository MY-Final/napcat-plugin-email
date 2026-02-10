import { useState, useEffect } from 'react'
import type { PluginStatus } from '../types'
import { IconPower, IconClock, IconActivity, IconDownload } from '../components/icons'

interface StatusPageProps {
    status: PluginStatus | null
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

export default function StatusPage({ status }: StatusPageProps) {
    const [displayUptime, setDisplayUptime] = useState<string>('-')
    const [syncInfo, setSyncInfo] = useState<{ baseUptime: number; syncTime: number } | null>(null)

    useEffect(() => {
        if (status?.uptime !== undefined && status.uptime > 0) {
            setSyncInfo({ baseUptime: status.uptime, syncTime: Date.now() })
        }
    }, [status?.uptime])

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

    const { stats } = status

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
            label: '今日处理',
            value: String(stats.todayProcessed),
            icon: <IconActivity size={18} />,
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
        },
        {
            label: '累计处理',
            value: String(stats.processed),
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

        </div>
    )
}
