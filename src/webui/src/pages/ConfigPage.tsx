import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { noAuthFetch } from '../utils/api'
import { showToast } from '../hooks/useToast'
import type { PluginConfig, EmailAccount, CreateEmailAccountParams, UpdateEmailAccountParams } from '../types'
import { IconSettings, IconPlus, IconEdit, IconTrash, IconCheck, IconX, IconStar, IconAlert } from '../components/icons'

export default function ConfigPage() {
    const [config, setConfig] = useState<PluginConfig | null>(null)
    const [accounts, setAccounts] = useState<EmailAccount[]>([])
    const [saving, setSaving] = useState(false)
    const [showAccountModal, setShowAccountModal] = useState(false)
    const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [accountToDelete, setAccountToDelete] = useState<EmailAccount | null>(null)
    const [accountForm, setAccountForm] = useState({
        name: '',
        host: '',
        port: 465,
        user: '',
        pass: '',
        senderName: 'QQ Bot',
        subjectPrefix: '[QQ Bot]',
        secure: true,
        isDefault: false,
    })

    const fetchConfig = useCallback(async () => {
        try {
            const res = await noAuthFetch<PluginConfig>('/config')
            if (res.code === 0 && res.data) {
                setConfig(res.data)
                setAccounts(res.data.emailAccounts || [])
            }
        } catch {
            showToast('获取配置失败', 'error')
        }
    }, [])

    useEffect(() => { fetchConfig() }, [fetchConfig])

    const handleSaveConfig = useCallback(async () => {
        if (!config) return
        setSaving(true)
        try {
            const res = await noAuthFetch('/config', {
                method: 'POST',
                body: JSON.stringify({
                    emailCommandPrefix: config.emailCommandPrefix,
                }),
            })
            if (res.code === 0) {
                showToast('配置已保存', 'success')
            } else {
                throw new Error(res.message)
            }
        } catch {
            showToast('保存配置失败', 'error')
        } finally {
            setSaving(false)
        }
    }, [config])

    const openCreateAccountModal = () => {
        setEditingAccount(null)
        setAccountForm({
            name: '',
            host: '',
            port: 465,
            user: '',
            pass: '',
            senderName: 'QQ Bot',
            subjectPrefix: '[QQ Bot]',
            secure: true,
            isDefault: accounts.length === 0,
        })
        setShowAccountModal(true)
    }

    const openEditAccountModal = (account: EmailAccount) => {
        setEditingAccount(account)
        setAccountForm({
            name: account.name,
            host: account.host,
            port: account.port,
            user: account.user,
            pass: account.pass || '',
            senderName: account.senderName,
            subjectPrefix: account.subjectPrefix,
            secure: account.secure,
            isDefault: account.isDefault,
        })
        setShowAccountModal(true)
    }

    const handleSaveAccount = async () => {
        if (!accountForm.name || !accountForm.host || !accountForm.user || !accountForm.pass) {
            showToast('请填写完整的账号信息', 'error')
            return
        }

        try {
            if (editingAccount) {
                const res = await noAuthFetch(`/email/accounts/${editingAccount.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(accountForm),
                })
                if (res.code === 0) {
                    showToast('账号更新成功', 'success')
                    setShowAccountModal(false)
                    fetchConfig()
                } else {
                    throw new Error(res.message)
                }
            } else {
                const res = await noAuthFetch('/email/accounts', {
                    method: 'POST',
                    body: JSON.stringify(accountForm),
                })
                if (res.code === 0) {
                    showToast('账号创建成功', 'success')
                    setShowAccountModal(false)
                    fetchConfig()
                } else {
                    throw new Error(res.message)
                }
            }
        } catch {
            showToast(editingAccount ? '更新账号失败' : '创建账号失败', 'error')
        }
    }

    const openDeleteModal = (account: EmailAccount) => {
        setAccountToDelete(account)
        setShowDeleteModal(true)
    }

    const handleDeleteAccount = async () => {
        if (!accountToDelete) return
        try {
            const res = await noAuthFetch(`/email/accounts/${accountToDelete.id}`, {
                method: 'DELETE',
            })
            if (res.code === 0) {
                showToast('删除成功', 'success')
                setShowDeleteModal(false)
                setAccountToDelete(null)
                fetchConfig()
            } else {
                throw new Error(res.message)
            }
        } catch (err) {
            showToast('删除失败', 'error')
        }
    }

    const handleSetDefault = async (id: string) => {
        try {
            const res = await noAuthFetch(`/email/accounts/${id}/default`, {
                method: 'POST',
            })
            if (res.code === 0) {
                showToast('已设为默认账号', 'success')
                fetchConfig()
            } else {
                throw new Error(res.message)
            }
        } catch {
            showToast('设置失败', 'error')
        }
    }

    const handleTestAccount = async (id: string) => {
        try {
            const res = await noAuthFetch(`/email/accounts/${id}/test`, {
                method: 'POST',
            })
            if (res.code === 0) {
                showToast('连接测试成功', 'success')
            } else {
                showToast(res.message || '连接测试失败', 'error')
            }
        } catch {
            showToast('连接测试失败', 'error')
        }
    }

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
            {/* 基本配置 */}
            <div className="card p-5 hover-lift">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-5">
                    <IconSettings size={16} className="text-gray-400" />
                    基本配置
                </h3>
                <div className="space-y-5">
                    <InputRow
                        label="邮件命令前缀"
                        desc="触发邮件命令的前缀"
                        value={config.emailCommandPrefix}
                        onChange={(v) => setConfig(prev => prev ? { ...prev, emailCommandPrefix: v } : null)}
                    />
                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveConfig}
                            disabled={saving}
                            className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving && <div className="loading-spinner !w-4 !h-4 !border-[1.5px]" />}
                            保存配置
                        </button>
                    </div>
                </div>
            </div>

            {/* 邮箱账号列表 */}
            <div className="card p-5 hover-lift">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <IconSettings size={16} className="text-gray-400" />
                        邮箱账号管理
                    </h3>
                    <button
                        onClick={openCreateAccountModal}
                        className="px-3 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 text-sm"
                    >
                        <IconPlus size={16} />
                        添加账号
                    </button>
                </div>

                {accounts.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-gray-400 dark:text-gray-500 mb-2">
                            <IconSettings size={48} className="mx-auto opacity-50" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">暂无邮箱账号</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">点击上方按钮添加第一个邮箱账号</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className={`p-4 rounded-lg border transition-colors ${
                                    account.isDefault
                                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h4 className="font-medium text-gray-900 dark:text-white truncate">
                                                {account.name}
                                            </h4>
                                            {account.isDefault && (
                                                <span className="px-2 py-0.5 text-xs bg-primary text-white rounded-full flex items-center gap-1">
                                                    <IconStar size={12} />
                                                    默认
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                            <p><span className="text-gray-400">SMTP:</span> {account.host}:{account.port}</p>
                                            <p><span className="text-gray-400">邮箱:</span> {account.user}</p>
                                            <p><span className="text-gray-400">发件人:</span> {account.senderName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {!account.isDefault && (
                                            <button
                                                onClick={() => handleSetDefault(account.id)}
                                                className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-colors"
                                                title="设为默认"
                                            >
                                                <IconStar size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleTestAccount(account.id)}
                                            className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                            title="测试连接"
                                        >
                                            <IconCheck size={18} />
                                        </button>
                                        <button
                                            onClick={() => openEditAccountModal(account)}
                                            className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                            title="编辑"
                                        >
                                            <IconEdit size={18} />
                                        </button>
                                        <button
                                            onClick={() => openDeleteModal(account)}
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
            </div>

            {/* 账号创建/编辑模态框 */}
            {showAccountModal && createPortal(
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[9999]"
                    onClick={() => setShowAccountModal(false)}
                >
                    <div
                        className="bg-white dark:bg-[#1a1b1d] rounded-2xl w-full max-w-lg shadow-2xl animate-modal-enter overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {editingAccount ? '编辑邮箱账号' : '添加邮箱账号'}
                            </h3>
                            <button
                                onClick={() => setShowAccountModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                            <InputRow
                                label="账号名称"
                                desc="用于识别此账号的显示名称"
                                value={accountForm.name}
                                onChange={(v) => setAccountForm(prev => ({ ...prev, name: v }))}
                            />
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
                                    <InputRow
                                        label="SMTP 服务器"
                                        desc="如 smtp.qq.com"
                                        value={accountForm.host}
                                        onChange={(v) => setAccountForm(prev => ({ ...prev, host: v }))}
                                    />
                                </div>
                                <InputRow
                                    label="端口"
                                    desc="通常 465 或 587"
                                    value={String(accountForm.port)}
                                    type="number"
                                    onChange={(v) => setAccountForm(prev => ({ ...prev, port: Number(v) || 465 }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputRow
                                    label="邮箱账号"
                                    desc="用于发送邮件的邮箱"
                                    value={accountForm.user}
                                    onChange={(v) => setAccountForm(prev => ({ ...prev, user: v }))}
                                />
                                <InputRow
                                    label="SMTP 授权码"
                                    desc="邮箱的 SMTP 授权码"
                                    value={accountForm.pass}
                                    type="password"
                                    onChange={(v) => setAccountForm(prev => ({ ...prev, pass: v }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <InputRow
                                    label="发件人名称"
                                    desc="显示在邮件中的名称"
                                    value={accountForm.senderName}
                                    onChange={(v) => setAccountForm(prev => ({ ...prev, senderName: v }))}
                                />
                                <InputRow
                                    label="邮件前缀"
                                    desc="如 [QQ Bot]"
                                    value={accountForm.subjectPrefix}
                                    onChange={(v) => setAccountForm(prev => ({ ...prev, subjectPrefix: v }))}
                                />
                            </div>
                            <ToggleRow
                                label="使用 SSL/TLS 加密"
                                desc="建议开启以确保安全"
                                checked={accountForm.secure}
                                onChange={(v) => setAccountForm(prev => ({ ...prev, secure: v }))}
                            />
                            {accounts.length > 0 && (
                                <ToggleRow
                                    label="设为默认账号"
                                    desc="新邮件默认使用此账号发送"
                                    checked={accountForm.isDefault}
                                    onChange={(v) => setAccountForm(prev => ({ ...prev, isDefault: v }))}
                                />
                            )}
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1b1d]">
                            <button
                                onClick={() => setShowAccountModal(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveAccount}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-medium"
                            >
                                <IconCheck size={16} />
                                {editingAccount ? '保存' : '添加'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 删除确认模态框 */}
            {showDeleteModal && accountToDelete && createPortal(
                <div
                    className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[9999]"
                    onClick={() => setShowDeleteModal(false)}
                >
                    <div
                        className="bg-white dark:bg-[#1a1b1d] rounded-2xl w-full max-w-md shadow-2xl animate-modal-enter overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <IconAlert size={20} className="text-red-500" />
                                确认删除
                            </h3>
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <IconX size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <p className="text-gray-700 dark:text-gray-300 mb-4">
                                确定要删除邮箱账号 <span className="font-semibold text-gray-900 dark:text-white">"{accountToDelete.name}"</span> 吗？
                            </p>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                <p><span className="text-gray-400">邮箱:</span> {accountToDelete.user}</p>
                                <p><span className="text-gray-400">SMTP:</span> {accountToDelete.host}:{accountToDelete.port}</p>
                            </div>
                            <p className="text-xs text-gray-400 mt-4">
                                此操作不可撤销，删除后该账号将无法用于发送邮件。
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1a1b1d]">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 font-medium"
                            >
                                <IconTrash size={16} />
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
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
