/**
 * 邮件服务模块
 * 使用 nodemailer 实现邮件发送功能
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type { SmtpConfig, SendEmailParams, EmailAttachment } from '../types';
import { pluginState } from '../core/state';
import fs from 'fs';
import path from 'path';

// 定义附件类型接口
interface ProcessedAttachment {
    filename: string;
    content?: Buffer;
    contentType?: string;
}

/**
 * 创建邮件传输器
 * @param smtpConfig SMTP 配置
 * @returns nodemailer Transporter 实例
 */
export function createTransporter(smtpConfig: SmtpConfig): Transporter {
    const transporter = nodemailer.createTransport({
        host: smtpConfig.host,
        port: smtpConfig.port,
        secure: smtpConfig.secure,
        auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });
    return transporter;
}

/**
 * 处理附件数据，转换为 nodemailer 格式
 * @param attachments 附件列表
 * @returns 处理后的附件列表
 */
async function processAttachments(attachments: EmailAttachment[]): Promise<ProcessedAttachment[]> {
    const processedAttachments: ProcessedAttachment[] = [];

    for (const att of attachments) {
        const attachment: ProcessedAttachment = {
            filename: att.filename,
        };

        // 如果提供了路径，从文件读取
        if (att.path && fs.existsSync(att.path)) {
            attachment.content = fs.readFileSync(att.path);
            if (!att.contentType) {
                // 根据文件扩展名推断 contentType
                const ext = path.extname(att.path).toLowerCase();
                attachment.contentType = getMimeType(ext);
            } else {
                attachment.contentType = att.contentType;
            }
        } else if (att.content) {
            // 使用提供的 content
            if (Buffer.isBuffer(att.content)) {
                attachment.content = att.content;
            } else if (typeof att.content === 'string') {
                // 假设是 base64 编码的字符串
                attachment.content = Buffer.from(att.content, 'base64');
            }
            if (att.contentType) {
                attachment.contentType = att.contentType;
            }
        }

        processedAttachments.push(attachment);
    }

    return processedAttachments;
}

/**
 * 根据文件扩展名获取 MIME 类型
 * @param ext 文件扩展名（包含点）
 * @returns MIME 类型
 */
function getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.zip': 'application/zip',
        '.txt': 'text/plain',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.csv': 'text/csv',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * 发送邮件
 * @param params 邮件参数
 * @returns 是否发送成功
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; message: string }> {
    const cfg = pluginState.config;
    const smtpConfig: SmtpConfig = {
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
        senderName: cfg.smtpSenderName,
        subjectPrefix: cfg.smtpSubjectPrefix,
        secure: cfg.smtpSecure,
    };

    // 验证 SMTP 配置
    const validation = validateSmtpConfig(smtpConfig);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    try {
        const transporter = createTransporter(smtpConfig);

        // 验证传输器配置
        await transporter.verify();

        // 构建邮件选项
        const mailOptions: nodemailer.SendMailOptions = {
            from: `"${smtpConfig.senderName}" <${smtpConfig.user}>`,
            to: params.to,
            subject: `${smtpConfig.subjectPrefix} ${params.subject}`,
        };

        // 调试日志
        pluginState.logger.debug(`发送邮件 - 收件人: ${params.to}`);

        // 如果有 HTML 内容，优先使用 HTML
        if (params.html) {
            mailOptions.html = params.html;
            // 如果没有纯文本，从 HTML 中提取（可选）
            if (!params.text) {
                mailOptions.text = params.html.replace(/<[^>]*>/g, '').substring(0, 500);
            } else {
                mailOptions.text = params.text;
            }
        } else {
            mailOptions.text = params.text;
        }

        // 处理附件
        if (params.attachments && params.attachments.length > 0) {
            mailOptions.attachments = await processAttachments(params.attachments);
        }

        const info = await transporter.sendMail(mailOptions);

        pluginState.logger.info(`邮件发送成功: ${info.messageId}`);
        return { success: true, message: `邮件发送成功: ${info.messageId}` };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        pluginState.logger.error('邮件发送失败:', error);
        return { success: false, message: `邮件发送失败: ${errorMessage}` };
    }
}

/**
 * 发送测试邮件
 * @param to 收件人邮箱
 * @returns 是否发送成功
 */
export async function sendTestEmail(to: string): Promise<{ success: boolean; message: string }> {
    const cfg = pluginState.config;
    const smtpConfig: SmtpConfig = {
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
        senderName: cfg.smtpSenderName,
        subjectPrefix: cfg.smtpSubjectPrefix,
        secure: cfg.smtpSecure,
    };

    const validation = validateSmtpConfig(smtpConfig);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    if (!to || !to.includes('@')) {
        return { success: false, message: '收件人邮箱地址无效' };
    }

    return sendEmail({
        to,
        subject: 'SMTP 配置测试',
        text: `这是一封测试邮件，用于验证 SMTP 配置是否正确。\n\n发送时间: ${new Date().toLocaleString('zh-CN')}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2 style="color: #4CAF50;">SMTP 配置测试</h2>
                <p>这是一封测试邮件，用于验证 SMTP 配置是否正确。</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="color: #666; font-size: 12px;">
                    发送时间: ${new Date().toLocaleString('zh-CN')}<br>
                    发件人: ${smtpConfig.senderName}
                </p>
            </div>
        `,
    });
}

/**
 * 验证 SMTP 配置
 * @param smtpConfig SMTP 配置
 * @returns 验证结果
 */
export function validateSmtpConfig(smtpConfig: SmtpConfig): { valid: boolean; message: string } {
    if (!smtpConfig.host) {
        return { valid: false, message: 'SMTP 服务器地址不能为空' };
    }
    if (!smtpConfig.port || smtpConfig.port <= 0 || smtpConfig.port > 65535) {
        return { valid: false, message: 'SMTP 端口无效' };
    }
    if (!smtpConfig.user) {
        return { valid: false, message: '邮箱账号不能为空' };
    }
    if (!smtpConfig.pass) {
        return { valid: false, message: 'SMTP 授权码不能为空' };
    }
    return { valid: true, message: '配置有效' };
}

/**
 * 测试 SMTP 连接
 * @returns 连接测试结果
 */
export async function testSmtpConnection(): Promise<{ success: boolean; message: string }> {
    const cfg = pluginState.config;
    const smtpConfig: SmtpConfig = {
        host: cfg.smtpHost,
        port: cfg.smtpPort,
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
        senderName: cfg.smtpSenderName,
        subjectPrefix: cfg.smtpSubjectPrefix,
        secure: cfg.smtpSecure,
    };

    const validation = validateSmtpConfig(smtpConfig);
    if (!validation.valid) {
        return { success: false, message: validation.message };
    }

    try {
        const transporter = createTransporter(smtpConfig);
        await transporter.verify();
        return { success: true, message: 'SMTP 连接测试成功' };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        pluginState.logger.error('SMTP 连接测试失败:', error);
        return { success: false, message: `SMTP 连接测试失败: ${errorMessage}` };
    }
}
