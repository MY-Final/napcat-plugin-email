/**
 * 邮件命令处理器
 * 处理邮件相关的 QQ 命令
 */

import type { OB11Message } from 'napcat-types/napcat-onebot';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { sendReply } from './message-handler';
import { sendEmail, sendTestEmail, validateSmtpConfig } from '../services/email-service';
import { pluginState } from '../core/state';

/**
 * 处理邮件命令
 * @param ctx 插件上下文
 * @param event 消息事件
 * @param args 命令参数
 * @returns 是否处理了该命令
 */
export async function handleEmailCommand(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<boolean> {
    const subCommand = args[0]?.toLowerCase() || '';

    switch (subCommand) {
        case 'send':
            return await handleSendEmail(ctx, event, args.slice(1));

        case 'test':
            return await handleTestEmail(ctx, event);

        case 'help':
        default:
            return await handleEmailHelp(ctx, event);
    }
}

/**
 * 处理发送邮件命令
 * 格式: #email send <收件人> <主题> <内容>
 */
async function handleSendEmail(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<boolean> {
    if (args.length < 3) {
        await sendReply(ctx, event, [
            '参数不足，正确格式：',
            '#email send <收件人邮箱> <主题> <内容>',
            '示例：#email send user@example.com 测试邮件 这是一封测试邮件',
        ].join('\n'));
        return true;
    }

    const [to, subject, ...contentParts] = args;
    const content = contentParts.join(' ');

    // 验证收件人邮箱
    if (!to.includes('@')) {
        await sendReply(ctx, event, '收件人邮箱格式无效，请检查邮箱地址');
        return true;
    }

    // 验证 SMTP 配置
    const cfg = pluginState.config;
    const smtpConfig = {
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
        await sendReply(ctx, event, `SMTP 配置错误：${validation.message}`);
        return true;
    }

    await sendReply(ctx, event, `正在发送邮件到 ${to}...`);

    const result = await sendEmail({
        to,
        subject,
        text: content,
    });

    await sendReply(ctx, event, result.message);
    return true;
}

/**
 * 处理测试邮件命令
 * 格式: #email test
 */
async function handleTestEmail(
    ctx: NapCatPluginContext,
    event: OB11Message
): Promise<boolean> {
    const cfg = pluginState.config;
    const smtpConfig = {
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
        await sendReply(ctx, event, `SMTP 配置错误：${validation.message}`);
        return true;
    }

    // 发送测试邮件到配置的邮箱
    const testEmail = smtpConfig.user;
    await sendReply(ctx, event, `正在发送测试邮件到 ${testEmail}...`);

    const result = await sendTestEmail(testEmail);
    await sendReply(ctx, event, result.message);
    return true;
}

/**
 * 处理邮件帮助命令
 */
async function handleEmailHelp(
    ctx: NapCatPluginContext,
    event: OB11Message
): Promise<boolean> {
    const prefix = pluginState.config.emailCommandPrefix || '#email';
    const helpText = [
        `[= 邮件服务命令 =]`,
        `${prefix} send <收件人> <主题> <内容> - 发送邮件`,
        `${prefix} test - 发送测试邮件到配置的邮箱`,
        `${prefix} help - 显示此帮助信息`,
        ``,
        `示例：`,
        `${prefix} send user@example.com 测试邮件 这是一封测试邮件`,
    ].join('\n');
    await sendReply(ctx, event, helpText);
    return true;
}
