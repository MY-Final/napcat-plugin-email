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
    /** 全局开关：是否启用插件功能 */
    enabled: boolean;
    /** 调试模式：启用后输出详细日志 */
    debug: boolean;
    /** 触发命令前缀，默认为 #cmd */
    commandPrefix: string;
    /** 同一命令请求冷却时间（秒），0 表示不限制 */
    cooldownSeconds: number;
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
