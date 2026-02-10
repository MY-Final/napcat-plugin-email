import { useState, useEffect, useCallback } from 'react'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'
import type { PluginConfig } from '../types'
import { IconSettings } from '../components/icons'

export default function ConfigPage() {
    const [config, setConfig] = useState<PluginConfig | null>(null)
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        smtpHost: '',
        smtpPort: 465,
        smtpUser: '',
        smtpPass: '',
        smtpSenderName: 'QQ Bot',
        smtpSubjectPrefix: '[QQ Bot]',
        smtpSecure: true,
        emailCommandPrefix: '#email',
    })

    const fetchConfig = useCallback(async () => {
        try {
            const res = await noAuthFetch<PluginConfig>('/config')
            if (res.code === 0 && res.data) {
                setConfig(res.data)
                setFormData({
                    smtpHost: res.data.smtpHost || '',
                    smtpPort: res.data.smtpPort || 465,
                    smtpUser: res.data.smtpUser || '',
                    smtpPass: res.data.smtpPass || '',
                    smtpSenderName: res.data.smtpSenderName || 'QQ Bot',
                    smtpSubjectPrefix: res.data.smtpSubjectPrefix || '[QQ Bot]',
                    smtpSecure: res.data.smtpSecure !== false,
                    emailCommandPrefix: res.data.emailCommandPrefix || '#email',
                })
            }
        } catch {
            showToast('获取配置失败', 'error')
        }
    }, [])

    useEffect(() => { fetchConfig() }, [fetchConfig])

    const saveConfig = useCallback(async () => {
        if (!config) return
        setSaving(true)
        try {
            const newConfig = { ...config, ...formData }
            const res = await noAuthFetch('/config', {
                method: 'POST',
                body: JSON.stringify(newConfig),
            })
            if (res.code === 0) {
                setConfig(newConfig)
                showToast('配置已保存', 'success')
            } else {
                throw new Error(res.message)
            }
        } catch {
            showToast('保存配置失败', 'error')
        } finally {
            setSaving(false)
        }
    }, [config, formData])

    if (!config) {
        return (
            <div className="flex items-center justify-center h-64 empty-state">
                <div className="flex flex-col items-center gap-3">
                    <div className="loading-spinner text-primary" />
                    <div className="text-gray-400 text-sm">加载配置中...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 stagger-children">
            {/* SMTP 配置 */}
            <div className="card p-5 hover-lift">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-5">
                    <IconSettings size={16} className="text-gray-400" />
                    SMTP 配置
                </h3>
                <div className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputRow
                            label="SMTP 服务器地址"
                            desc="如 smtp.qq.com"
                            value={formData.smtpHost}
                            onChange={(v) => setFormData(prev => ({ ...prev, smtpHost: v }))}
                        />
                        <InputRow
                            label="SMTP 端口"
                            desc="通常为 465 或 587"
                            value={String(formData.smtpPort)}
                            type="number"
                            onChange={(v) => setFormData(prev => ({ ...prev, smtpPort: Number(v) || 465 }))}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputRow
                            label="邮箱账号"
                            desc="用于发送邮件的邮箱"
                            value={formData.smtpUser}
                            onChange={(v) => setFormData(prev => ({ ...prev, smtpUser: v }))}
                        />
                        <InputRow
                            label="SMTP 授权码"
                            desc="邮箱的 SMTP 授权码"
                            value={formData.smtpPass}
                            type="password"
                            onChange={(v) => setFormData(prev => ({ ...prev, smtpPass: v }))}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputRow
                            label="发件人名称"
                            desc="显示在邮件中的名称"
                            value={formData.smtpSenderName}
                            onChange={(v) => setFormData(prev => ({ ...prev, smtpSenderName: v }))}
                        />
                        <InputRow
                            label="邮件标题前缀"
                            desc="如 [QQ Bot]"
                            value={formData.smtpSubjectPrefix}
                            onChange={(v) => setFormData(prev => ({ ...prev, smtpSubjectPrefix: v }))}
                        />
                    </div>
                    <ToggleRow
                        label="使用 SSL/TLS 加密"
                        desc="建议开启以确保安全"
                        checked={formData.smtpSecure}
                        onChange={(v) => setFormData(prev => ({ ...prev, smtpSecure: v }))}
                    />
                    <InputRow
                        label="邮件命令前缀"
                        desc="触发邮件命令的前缀"
                        value={formData.emailCommandPrefix}
                        onChange={(v) => setFormData(prev => ({ ...prev, emailCommandPrefix: v }))}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={saveConfig}
                            disabled={saving}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <div className="loading-spinner !w-4 !h-4 !border-[1.5px]" />}
                            保存配置
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ---- 子组件 ---- */

function ToggleRow({ label, desc, checked, onChange }: {
    label: string; desc: string; checked: boolean; onChange: (v: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
            </div>
            <label className="toggle">
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                <div className="slider" />
            </label>
        </div>
    )
}

function InputRow({ label, desc, value, type = 'text', onChange }: {
    label: string; desc: string; value: string; type?: string; onChange: (v: string) => void
}) {
    const [local, setLocal] = useState(value)
    useEffect(() => { setLocal(value) }, [value])

    const handleBlur = () => {
        if (local !== value) onChange(local)
    }

    return (
        <div>
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">{label}</div>
            <div className="text-xs text-gray-400 mb-2">{desc}</div>
            <input
                className="input-field"
                type={type}
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            />
        </div>
    )
}
