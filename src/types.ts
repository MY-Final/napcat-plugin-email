/**
 * 类型定义文件
 * 定义插件内部使用的接口和类型
 *
 * 注意：OneBot 相关类型（OB11Message, OB11PostSendMsg 等）
 * 以及插件框架类型（NapCatPluginContext, PluginModule 等）
 * 均来自 napcat-types 包，无需在此重复定义。
 */

// ==================== 插件配置 ====================

/**
 * SMTP 配置接口（扁平结构）
 */
export interface SmtpConfig {
    /** SMTP 服务器地址 */
    host: string;
    /** SMTP 端口 */
    port: number;
    /** 邮箱账号 */
    user: string;
    /** SMTP 授权码 */
    pass: string;
    /** 发件人名称 */
    senderName: string;
    /** 邮件标题前缀 */
    subjectPrefix: string;
    /** 是否使用 SSL/TLS 加密 */
    secure: boolean;
}

/**
 * 邮件附件接口
 */
export interface EmailAttachment {
    /** 文件名 */
    filename: string;
    /** 文件内容（Buffer 或 Base64 字符串） */
    content: Buffer | string;
    /** 文件路径（可选，与 content 二选一） */
    path?: string;
    /** 内容类型（MIME type，可选） */
    contentType?: string;
}

/**
 * 发送邮件参数接口
 */
export interface SendEmailParams {
    /** 收件人 */
    to: string;
    /** 主题 */
    subject: string;
    /** 纯文本内容 */
    text?: string;
    /** HTML 内容 */
    html?: string;
    /** 附件列表 */
    attachments?: EmailAttachment[];
}

/**
 * 插件主配置接口
 * 在此定义你的插件所需的所有配置项
 */
export interface PluginConfig {
    /** 按群的单独配置 */
    groupConfigs: Record<string, GroupConfig>;
    /** 邮件命令前缀，默认为 #email */
    emailCommandPrefix: string;
    /** SMTP 服务器地址 */
    smtpHost: string;
    /** SMTP 端口 */
    smtpPort: number;
    /** 邮箱账号 */
    smtpUser: string;
    /** SMTP 授权码 */
    smtpPass: string;
    /** 发件人名称 */
    smtpSenderName: string;
    /** 邮件标题前缀 */
    smtpSubjectPrefix: string;
    /** 是否使用 SSL/TLS 加密 */
    smtpSecure: boolean;
}

/**
 * 群配置
 */
export interface GroupConfig {
    /** 是否启用此群的功能 */
    enabled?: boolean;
    // TODO: 在这里添加群级别的配置项
}

// ==================== 定时邮件 ====================

/**
 * 定时邮件任务接口
 */
export interface ScheduledEmail {
    /** 任务唯一 ID */
    id: string;
    /** 任务名称 */
    name: string;
    /** 收件人（多个用逗号分隔） */
    to: string;
    /** 邮件主题 */
    subject: string;
    /** 邮件内容（纯文本） */
    text?: string;
    /** 邮件内容（HTML） */
    html?: string;
    /** 附件列表 */
    attachments?: EmailAttachment[];
    /** 定时类型：once=一次性, daily=每天, weekly=每周, monthly=每月, interval=间隔 */
    scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'interval';
    /** 发送时间（ISO 8601 格式） */
    scheduledAt: string;
    /** 间隔时间（分钟，仅 interval 类型使用） */
    intervalMinutes?: number;
    /** 星期几（0-6，仅 weekly 类型使用，0=周日） */
    weekday?: number;
    /** 每月几号（1-31，仅 monthly 类型使用） */
    dayOfMonth?: number;
    /** 任务状态 */
    status: 'pending' | 'sent' | 'failed' | 'cancelled';
    /** 创建时间 */
    createdAt: string;
    /** 最后发送时间 */
    lastSentAt?: string;
    /** 错误信息 */
    errorMessage?: string;
    /** 发送次数（用于重复任务） */
    sendCount: number;
    /** 最大发送次数（null 表示无限） */
    maxSendCount?: number | null;
}

/**
 * 创建定时邮件请求参数
 */
export interface CreateScheduledEmailParams {
    name: string;
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
    scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'interval';
    scheduledAt: string;
    intervalMinutes?: number;
    weekday?: number;
    dayOfMonth?: number;
    maxSendCount?: number | null;
}

/**
 * 更新定时邮件请求参数
 */
export interface UpdateScheduledEmailParams {
    name?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
    attachments?: EmailAttachment[];
    scheduleType?: 'once' | 'daily' | 'weekly' | 'monthly' | 'interval';
    scheduledAt?: string;
    intervalMinutes?: number;
    weekday?: number;
    dayOfMonth?: number;
    status?: 'pending' | 'sent' | 'failed' | 'cancelled';
    maxSendCount?: number | null;
}

// ==================== 邮件历史记录 ====================

/**
 * 邮件发送类型
 */
export type EmailSendType = 'scheduled' | 'manual' | 'test';

/**
 * 邮件发送状态
 */
export type EmailSendStatus = 'success' | 'failed';

/**
 * 邮件历史记录接口
 */
export interface EmailHistory {
    /** 记录唯一 ID */
    id: string;
    /** 发送类型：scheduled=定时任务, manual=手动发送, test=测试邮件 */
    sendType: EmailSendType;
    /** 收件人（多个用逗号分隔） */
    to: string;
    /** 邮件主题 */
    subject: string;
    /** 纯文本内容（可选） */
    text?: string;
    /** HTML 内容（可选） */
    html?: string;
    /** 发送状态：success=成功, failed=失败 */
    status: EmailSendStatus;
    /** 错误信息（失败时记录） */
    errorMessage?: string;
    /** 发送时间 */
    sentAt: string;
    /** 关联的定时任务 ID（仅定时任务类型） */
    scheduledEmailId?: string;
    /** 附件数量 */
    attachmentCount: number;
    /** 附件列表（详细信息） */
    attachments?: { filename: string; contentType?: string }[];
}

/**
 * 邮件发送统计
 */
export interface EmailHistoryStats {
    /** 总发送数 */
    total: number;
    /** 成功数 */
    success: number;
    /** 失败数 */
    failed: number;
    /** 定时任务发送数 */
    scheduled: number;
    /** 手动发送数 */
    manual: number;
    /** 测试邮件数 */
    test: number;
}

// ==================== API 响应 ====================

/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = unknown> {
    /** 状态码，0 表示成功，-1 表示失败 */
    code: number;
    /** 错误信息（仅错误时返回） */
    message?: string;
    /** 响应数据（仅成功时返回） */
    data?: T;
}
