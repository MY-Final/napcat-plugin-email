/** WebUI 前端类型定义 */

export interface PluginStatus {
    pluginName: string
    uptime: number
    uptimeFormatted: string
    config: PluginConfig
    stats: {
        processed: number
        todayProcessed: number
        lastUpdateDay: string
    }
}

export interface SmtpConfig {
    host: string
    port: number
    user: string
    senderName: string
    subjectPrefix: string
    secure: boolean
}

export interface SmtpConfigWithPass extends SmtpConfig {
    pass: string
}

export interface EmailAccount {
    id: string
    name: string
    isDefault: boolean
    host: string
    port: number
    user: string
    pass?: string
    senderName: string
    subjectPrefix: string
    secure: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateEmailAccountParams {
    name: string
    host: string
    port: number
    user: string
    pass: string
    senderName: string
    subjectPrefix: string
    secure: boolean
    isDefault?: boolean
}

export interface UpdateEmailAccountParams {
    name?: string
    host?: string
    port?: number
    user?: string
    pass?: string
    senderName?: string
    subjectPrefix?: string
    secure?: boolean
    isDefault?: boolean
}

export interface SendEmailParams {
    accountId?: string
    to: string
    subject: string
    text?: string
    html?: string
    attachments?: EmailAttachment[]
}

export interface PluginConfig {
    groupConfigs?: Record<string, GroupConfig>
    emailCommandPrefix: string
    emailAccounts: EmailAccount[]
    defaultAccountId: string | null
}

export interface GroupConfig {
    enabled?: boolean
}

export interface GroupInfo {
    group_id: number
    group_name: string
    member_count: number
    max_member_count: number
    enabled: boolean
    /** 定时推送时间（如 '08:30'），null 表示未设置（模板默认不使用，按需扩展） */
    scheduleTime?: string | null
}

export interface ApiResponse<T = unknown> {
    code: number
    data?: T
    message?: string
}

export interface EmailAttachment {
    filename: string
    path: string
    contentType: string
}

export interface ScheduledEmail {
    id: string
    name: string
    accountId: string
    to: string
    subject: string
    text?: string
    html?: string
    attachments?: EmailAttachment[]
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

// ==================== 邮件历史记录 ====================

export type EmailSendType = 'scheduled' | 'manual' | 'test'
export type EmailSendStatus = 'success' | 'failed'

export interface EmailHistory {
    id: string
    sendType: EmailSendType
    accountId: string
    to: string
    subject: string
    text?: string
    html?: string
    status: EmailSendStatus
    errorMessage?: string
    sentAt: string
    scheduledEmailId?: string
    attachmentCount: number
    attachments?: { filename: string; contentType?: string }[]
}

export interface EmailHistoryStats {
    total: number
    success: number
    failed: number
    scheduled: number
    manual: number
    test: number
}

export interface EmailHistoryResponse {
    list: EmailHistory[]
    total: number
    page: number
    pageSize: number
}
