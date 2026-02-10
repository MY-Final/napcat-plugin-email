import { useState, useEffect, useCallback } from 'react'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'
import type { PluginConfig, SendEmailParams } from '../types'
import { IconMail, IconSend, IconSettings, IconTestTube } from '../components/icons'

export default function EmailPage() {
    const [config, setConfig] = useState<PluginConfig | null>(null)
    const [smtpHost, setSmtpHost] = useState('')
    const [smtpPort, setSmtpPort] = useState(465)
    const [smtpUser, setSmtpUser] = useState('')
    const [smtpPass, setSmtpPass] = useState('')
    const [smtpSenderName, setSmtpSenderName] = useState('QQ Bot')
    const [smtpSubjectPrefix, setSmtpSubjectPrefix] = useState('[QQ Bot]')
    const [smtpSecure, setSmtpSecure] = useState(true)
    const [emailCommandPrefix, setEmailCommandPrefix] = useState('#email')
    const [testEmail, setTestEmail] = useState('')
    const [sendForm, setSendForm] = useState<SendEmailParams>({
        to: '',
        subject: '',
        text: '',
    })
    const [loading, setLoading] = useState({
        config: false,
        test: false,
        send: false,
    })

    const fetchConfig = useCallback(async () => {
        try {
            const res = await noAuthFetch<PluginConfig>('/config')
            if (res.code === 0 && res.data) {
                setConfig(res.data)
                setSmtpHost(res.data.smtpHost)
                setSmtpPort(res.data.smtpPort)
                setSmtpUser(res.data.smtpUser)
                setSmtpPass(res.data.smtpPass)
                setSmtpSenderName(res.data.smtpSenderName)
                setSmtpSubjectPrefix(res.data.smtpSubjectPrefix)
                setSmtpSecure(res.data.smtpSecure)
                setEmailCommandPrefix(res.data.emailCommandPrefix || '#email')
            }
        } catch {
            showToast('获取配置失败', 'error')
        }
    }, [])

    useEffect(() => { fetchConfig() }, [fetchConfig])

    const saveSmtpConfig = useCallback(async () => {
        if (!config) return
        setLoading(prev => ({ ...prev, config: true }))
        try {
            const newConfig = {
                ...config,
                smtpHost,
                smtpPort,
                smtpUser,
                smtpPass,
                smtpSenderName,
                smtpSubjectPrefix,
                smtpSecure,
                emailCommandPrefix,
            }
            const res = await noAuthFetch('/config', {
                method: 'POST',
                body: JSON.stringify(newConfig),
            })
            if (res.code === 0) {
                setConfig(newConfig)
                showToast('SMTP 配置已保存', 'success')
            } else {
                throw new Error(res.message)
            }
        } catch {
            showToast('保存配置失败', 'error')
        } finally {
            setLoading(prev => ({ ...prev, config: false }))
        }
    }, [config, smtpHost, smtpPort, smtpUser, smtpPass, smtpSenderName, smtpSubjectPrefix, smtpSecure, emailCommandPrefix])

    const testSmtpConfig = useCallback(async () => {
        const testTo = testEmail || smtpUser
        if (!testTo) {
            showToast('请输入测试邮箱地址', 'error')
            return
        }
        setLoading(prev => ({ ...prev, test: true }))
        try {
            const res = await noAuthFetch('/email/test', {
                method: 'POST',
                body: JSON.stringify({ to: testTo }),
            })
            if (res.code === 0) {
                showToast('测试邮件发送成功', 'success')
            } else {
                showToast(res.message || '测试失败', 'error')
            }
        } catch {
            showToast('测试邮件发送失败', 'error')
        } finally {
            setLoading(prev => ({ ...prev, test: false }))
        }
    }, [testEmail, smtpUser])

    const sendEmail = useCallback(async () => {
        if (!sendForm.to || !sendForm.subject) {
            showToast('请填写收件人和主题', 'error')
            return
        }
        setLoading(prev => ({ ...prev, send: true }))
        try {
            const res = await noAuthFetch('/email/send', {
                method: 'POST',
                body: JSON.stringify(sendForm),
            })
            if (res.code === 0) {
                showToast('邮件发送成功', 'success')
                setSendForm({ to: '', subject: '', text: '' })
            } else {
                showToast(res.message || '发送失败', 'error')
            }
        } catch {
            showToast('邮件发送失败', 'error')
        } finally {
            setLoading(prev => ({ ...prev, send: false }))
        }
    }, [sendForm])

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
                            value={smtpHost}
                            onChange={setSmtpHost}
                        />
                        <InputRow
                            label="SMTP 端口"
                            desc="通常为 465 或 587"
                            value={String(smtpPort)}
                            type="number"
                            onChange={(v) => setSmtpPort(Number(v) || 465)}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputRow
                            label="邮箱账号"
                            desc="用于发送邮件的邮箱"
                            value={smtpUser}
                            onChange={setSmtpUser}
                        />
                        <InputRow
                            label="SMTP 授权码"
                            desc="邮箱的 SMTP 授权码"
                            value={smtpPass}
                            type="password"
                            onChange={setSmtpPass}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputRow
                            label="发件人名称"
                            desc="显示在邮件中的名称"
                            value={smtpSenderName}
                            onChange={setSmtpSenderName}
                        />
                        <InputRow
                            label="邮件标题前缀"
                            desc="如 [QQ Bot]"
                            value={smtpSubjectPrefix}
                            onChange={setSmtpSubjectPrefix}
                        />
                    </div>
                    <ToggleRow
                        label="使用 SSL/TLS 加密"
                        desc="建议开启以确保安全"
                        checked={smtpSecure}
                        onChange={setSmtpSecure}
                    />
                    <InputRow
                        label="邮件命令前缀"
                        desc="触发邮件命令的前缀"
                        value={emailCommandPrefix}
                        onChange={setEmailCommandPrefix}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={saveSmtpConfig}
                            disabled={loading.config}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading.config && <div className="loading-spinner !w-4 !h-4 !border-[1.5px]" />}
                            保存配置
                        </button>
                    </div>
                </div>
            </div>

            {/* 测试邮件 */}
            <div className="card p-5 hover-lift">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-5">
                    <IconTestTube size={16} className="text-gray-400" />
                    测试邮件
                </h3>
                <div className="space-y-4">
                    <InputRow
                        label="测试邮箱地址"
                        desc="留空则发送到配置的邮箱账号"
                        value={testEmail}
                        placeholder={smtpUser}
                        onChange={setTestEmail}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={testSmtpConfig}
                            disabled={loading.test}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading.test && <div className="loading-spinner !w-4 !h-4 !border-[1.5px]" />}
                            <IconTestTube size={16} />
                            发送测试邮件
                        </button>
                    </div>
                </div>
            </div>

            {/* 发送邮件 */}
            <div className="card p-5 hover-lift">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-5">
                    <IconSend size={16} className="text-gray-400" />
                    发送邮件
                </h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputRow
                            label="收件人"
                            desc="收件人邮箱地址"
                            value={sendForm.to}
                            onChange={(v) => setSendForm(prev => ({ ...prev, to: v }))}
                        />
                        <InputRow
                            label="主题"
                            desc="邮件主题"
                            value={sendForm.subject}
                            onChange={(v) => setSendForm(prev => ({ ...prev, subject: v }))}
                        />
                    </div>
                    <TextAreaRow
                        label="内容"
                        desc="邮件正文（纯文本）"
                        value={sendForm.text || ''}
                        onChange={(v) => setSendForm(prev => ({ ...prev, text: v }))}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={sendEmail}
                            disabled={loading.send}
                            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading.send && <div className="loading-spinner !w-4 !h-4 !border-[1.5px]" />}
                            <IconMail size={16} />
                            发送邮件
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

function InputRow({ label, desc, value, type = 'text', placeholder, onChange }: {
    label: string; desc: string; value: string; type?: string; placeholder?: string; onChange: (v: string) => void
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
                placeholder={placeholder}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            />
        </div>
    )
}

function TextAreaRow({ label, desc, value, onChange }: {
    label: string; desc: string; value: string; onChange: (v: string) => void
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
            <textarea
                className="input-field min-h-[120px] resize-y"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={handleBlur}
            />
        </div>
    )
}
