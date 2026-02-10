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

export interface SendEmailParams {
    to: string
    subject: string
    text?: string
    html?: string
}

export interface PluginConfig {
    enabled: boolean
    debug: boolean
    commandPrefix: string
    cooldownSeconds: number
    groupConfigs?: Record<string, GroupConfig>
    emailCommandPrefix: string
    smtpHost: string
    smtpPort: number
    smtpUser: string
    smtpPass: string
    smtpSenderName: string
    smtpSubjectPrefix: string
    smtpSecure: boolean
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
