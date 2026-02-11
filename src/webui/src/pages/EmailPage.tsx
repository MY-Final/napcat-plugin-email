import { useState, useEffect, useCallback, useRef } from 'react'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'
import type { PluginConfig, SendEmailParams, EmailAttachment, EmailAccount } from '../types'
import { IconMail, IconSend, IconTestTube, IconPaperclip, IconCode, IconX, IconStar } from '../components/icons'

interface UploadResponse {
    path: string;
    filename: string;
    size: number;
}

export default function EmailPage() {
    const [config, setConfig] = useState<PluginConfig | null>(null)
    const [accounts, setAccounts] = useState<EmailAccount[]>([])
    const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null)
    const [selectedAccountId, setSelectedAccountId] = useState<string>('')
    const [testEmail, setTestEmail] = useState('')
    const [sendForm, setSendForm] = useState<SendEmailParams>({
        to: '',
        subject: '',
        text: '',
    })
    const [isHtmlMode, setIsHtmlMode] = useState(false)
    const [attachments, setAttachments] = useState<EmailAttachment[]>([])
    const [loading, setLoading] = useState({
        test: false,
        send: false,
    })
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchConfig = useCallback(async () => {
        try {
            const res = await noAuthFetch<PluginConfig>('/config')
            if (res.code === 0 && res.data) {
                setConfig(res.data)
                setAccounts(res.data.emailAccounts || [])
                setDefaultAccountId(res.data.defaultAccountId || null)
                // 设置默认选中的账号
                if (res.data.defaultAccountId) {
                    setSelectedAccountId(res.data.defaultAccountId)
                } else if (res.data.emailAccounts && res.data.emailAccounts.length > 0) {
                    setSelectedAccountId(res.data.emailAccounts[0].id)
                }
            }
        } catch {
            showToast('获取配置失败', 'error')
        }
    }, [])

    useEffect(() => { fetchConfig() }, [fetchConfig])

    const testSmtpConfig = useCallback(async () => {
        if (!selectedAccountId && accounts.length > 0) {
            showToast('请选择要测试的邮箱账号', 'error')
            return
        }

        const targetEmail = testEmail || accounts.find(a => a.id === selectedAccountId)?.user
        if (!targetEmail) {
            showToast('请输入测试邮箱地址', 'error')
            return
        }

        setLoading(prev => ({ ...prev, test: true }))
        try {
            const res = await noAuthFetch('/email/test', {
                method: 'POST',
                body: JSON.stringify({
                    to: targetEmail,
                    accountId: selectedAccountId || undefined,
                }),
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
    }, [testEmail, selectedAccountId, accounts])

    const handleFileUpload = useCallback(async (file: File) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        return new Promise<EmailAttachment>((resolve, reject) => {
            reader.onload = async () => {
                const base64Content = (reader.result as string).split(',')[1]
                const res = await noAuthFetch('/email/upload', {
                    method: 'POST',
                    body: JSON.stringify({ filename: file.name, content: base64Content }),
                })
                if (res.code === 0 && res.data) {
                    const uploadData = res.data as UploadResponse;
                    resolve({ filename: file.name, path: uploadData.path, contentType: file.type })
                } else {
                    reject(new Error(res.message || '上传失败'))
                }
            }
            reader.onerror = () => reject(new Error('文件读取失败'))
        })
    }, [])

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        try {
            for (const file of Array.from(files)) {
                if (file.size > 1024 * 1024 * 1024) {
                    showToast(`文件 ${file.name} 太大（最大 1GB）`, 'error')
                    continue
                }
                const attachment = await handleFileUpload(file)
                setAttachments(prev => [...prev, attachment])
                showToast(`文件 ${file.name} 上传成功`, 'success')
            }
        } catch {
            showToast('文件上传失败', 'error')
        }
        e.target.value = ''
    }, [handleFileUpload])

    const removeAttachment = useCallback((index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index))
    }, [])

    const sendEmail = useCallback(async () => {
        if (!sendForm.to || !sendForm.subject) {
            showToast('请填写收件人和主题', 'error')
            return
        }
        if (!selectedAccountId && accounts.length > 0) {
            showToast('请选择要使用的邮箱账号', 'error')
            return
        }
        if (!isHtmlMode && !sendForm.text) {
            showToast('请填写邮件内容', 'error')
            return
        }
        if (isHtmlMode && !sendForm.html) {
            showToast('请填写 HTML 邮件内容', 'error')
            return
        }
        setLoading(prev => ({ ...prev, send: true }))
        try {
            const payload = {
                accountId: selectedAccountId || undefined,
                ...sendForm,
                attachments: attachments.length > 0 ? attachments : undefined,
            }
            const res = await noAuthFetch('/email/send', {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            if (res.code === 0) {
                showToast('邮件发送成功', 'success')
                setSendForm({ to: '', subject: '', text: '' })
                setAttachments([])
                setIsHtmlMode(false)
            } else {
                showToast(res.message || '发送失败', 'error')
            }
        } catch {
            showToast('邮件发送失败', 'error')
        } finally {
            setLoading(prev => ({ ...prev, send: false }))
        }
    }, [sendForm, attachments, isHtmlMode, selectedAccountId, accounts])

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

    const selectedAccount = accounts.find(a => a.id === selectedAccountId)

    return (
        <div className="space-y-6 stagger-children">
            {/* 测试邮件 */}
            <div className="card p-5 hover-lift">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-5">
                    <IconTestTube size={16} className="text-gray-400" />
                    测试邮件
                </h3>
                <div className="space-y-4">
                    <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">选择账号</div>
                        <div className="text-xs text-gray-400 mb-2">选择要测试的邮箱账号</div>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="input-field"
                        >
                            <option value="">请选择账号</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name} {account.isDefault && '(默认)'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <InputRow
                        label="测试邮箱地址"
                        desc="留空则发送到选中的账号邮箱"
                        value={testEmail}
                        placeholder={selectedAccount?.user || 'user@example.com'}
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
                    <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">选择发件账号</div>
                        <div className="text-xs text-gray-400 mb-2">选择要用于发送此邮件的邮箱账号</div>
                        <select
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="input-field"
                        >
                            <option value="">请选择账号</option>
                            {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name} {account.isDefault && '(默认)'} - {account.user}
                                </option>
                            ))}
                        </select>
                    </div>
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

                    {/* 模式切换按钮 */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsHtmlMode(false)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                                !isHtmlMode
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            纯文本
                        </button>
                        <button
                            onClick={() => setIsHtmlMode(true)}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
                                isHtmlMode
                                    ? 'bg-primary text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <IconCode size={14} />
                            HTML
                        </button>
                    </div>

                    {/* 根据模式显示不同的文本框 */}
                    {!isHtmlMode ? (
                        <TextAreaRow
                            label="内容"
                            desc="邮件正文（纯文本）"
                            value={sendForm.text || ''}
                            onChange={(v) => setSendForm(prev => ({ ...prev, text: v }))}
                        />
                    ) : (
                        <TextAreaRow
                            label="HTML 内容"
                            desc="邮件正文（HTML 格式）"
                            value={sendForm.html || ''}
                            onChange={(v) => setSendForm(prev => ({ ...prev, html: v }))}
                        />
                    )}

                    {/* 附件上传区域 */}
                    <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">附件</div>
                        <div className="text-xs text-gray-400 mb-2">支持多个文件，单个文件最大 1GB</div>
                        <div className="flex items-center gap-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
                            >
                                <IconPaperclip size={16} />
                                选择文件
                            </button>
                            <span className="text-xs text-gray-400">
                                已选择 {attachments.length} 个文件
                            </span>
                        </div>

                        {/* 已上传附件列表 */}
                        {attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {attachments.map((att, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <IconPaperclip size={14} className="text-gray-400 flex-shrink-0" />
                                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                                {att.filename}
                                            </span>
                                            <span className="text-xs text-gray-400 flex-shrink-0">
                                                ({att.contentType})
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => removeAttachment(index)}
                                            className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                                            title="删除附件"
                                        >
                                            <IconX size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

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
