/**
 * 邮件命令处理器
 * 处理邮件相关的 QQ 命令
 */

import type { OB11Message } from 'napcat-types/napcat-onebot';
import type { NapCatPluginContext } from 'napcat-types/napcat-onebot/network/plugin/types';
import { sendReply } from './message-handler';
import { sendEmail, sendTestEmail, validateSmtpConfig } from '../services/email-service';
import { pluginState } from '../core/state';
import {
    getScheduledEmails,
    createScheduledEmail,
    deleteScheduledEmail,
    cancelScheduledEmail,
    validateScheduledEmailParams,
    executeScheduledEmail
} from '../services/scheduled-email-service';
import type { CreateScheduledEmailParams, ScheduledEmail } from '../types';

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

        case 'scheduled':
        case 'schedule':
            return await handleScheduledEmailCommand(ctx, event, args.slice(1));

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
        `${prefix} scheduled list - 查看定时邮件列表`,
        `${prefix} scheduled create <任务名称> <收件人> <主题> <内容> <时间> - 创建定时邮件`,
        `${prefix} scheduled delete <任务ID> - 删除定时邮件`,
        `${prefix} scheduled cancel <任务ID> - 取消定时邮件`,
        `${prefix} scheduled help - 显示定时邮件帮助`,
        `${prefix} help - 显示此帮助信息`,
        ``,
        `示例：`,
        `${prefix} send user@example.com 测试邮件 这是一封测试邮件`,
        `${prefix} scheduled create 每日日报 user@example.com 日报 这是今天的日报内容 2026-02-11T09:00:00`,
    ].join('\n');
    await sendReply(ctx, event, helpText);
    return true;
}

/**
 * 处理定时邮件命令
 */
async function handleScheduledEmailCommand(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<boolean> {
    const subCommand = args[0]?.toLowerCase() || '';

    switch (subCommand) {
        case 'list':
            return await handleScheduledList(ctx, event);

        case 'create':
            return await handleScheduledCreate(ctx, event, args.slice(1));

        case 'delete':
            return await handleScheduledDelete(ctx, event, args.slice(1));

        case 'cancel':
            return await handleScheduledCancel(ctx, event, args.slice(1));

        case 'exec':
        case 'execute':
            return await handleScheduledExecute(ctx, event, args.slice(1));

        case 'help':
        default:
            return await handleScheduledHelp(ctx, event);
    }
}

/**
 * 查看定时邮件列表
 */
async function handleScheduledList(
    ctx: NapCatPluginContext,
    event: OB11Message
): Promise<boolean> {
    const emails = getScheduledEmails();
    
    if (emails.length === 0) {
        await sendReply(ctx, event, '暂无定时邮件任务');
        return true;
    }

    const statusMap: Record<string, string> = {
        pending: '待发送',
        sent: '已完成',
        failed: '失败',
        cancelled: '已取消',
    };

    const typeMap: Record<string, string> = {
        once: '一次性',
        daily: '每天',
        weekly: '每周',
        monthly: '每月',
        interval: '间隔',
    };

    const list = emails.slice(0, 10).map((email, index) => {
        return `${index + 1}. ${email.name}\n   ID: ${email.id}\n   收件人: ${email.to}\n   状态: ${statusMap[email.status]} | 类型: ${typeMap[email.scheduleType]}\n   下次发送: ${email.status === 'pending' ? new Date(email.scheduledAt).toLocaleString('zh-CN') : '-'}`;
    }).join('\n\n');

    const moreText = emails.length > 10 ? `\n\n...还有 ${emails.length - 10} 个任务` : '';
    
    await sendReply(ctx, event, `[= 定时邮件列表 =]\n\n${list}${moreText}`);
    return true;
}

/**
 * 创建定时邮件
 * 格式: #email scheduled create <任务名称> <收件人> <主题> <内容> <时间>
 */
async function handleScheduledCreate(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<boolean> {
    if (args.length < 5) {
        await sendReply(ctx, event, [
            '参数不足，正确格式：',
            '#email scheduled create <任务名称> <收件人> <主题> <内容> <时间>',
            '',
            '时间格式：',
            '一次性: 2026-02-11T09:00:00（ISO 8601格式）',
            '',
            '示例：',
            '#email scheduled create 每日日报 user@example.com 日报 这是今天的日报内容 2026-02-11T09:00:00',
        ].join('\n'));
        return true;
    }

    const [name, to, subject, ...rest] = args;
    const scheduledAt = rest.pop() || '';
    const content = rest.join(' ');

    // 验证时间格式
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
        await sendReply(ctx, event, '时间格式无效，请使用 ISO 8601 格式，如：2026-02-11T09:00:00');
        return true;
    }

    const params: CreateScheduledEmailParams = {
        name,
        to,
        subject,
        text: content,
        scheduleType: 'once',
        scheduledAt: scheduledDate.toISOString(),
    };

    // 验证参数
    const validation = validateScheduledEmailParams(params);
    if (!validation.valid) {
        await sendReply(ctx, event, `参数错误：${validation.message}`);
        return true;
    }

    try {
        const email = createScheduledEmail(params);
        await sendReply(ctx, event, [
            '✅ 定时邮件任务创建成功！',
            `任务名称: ${email.name}`,
            `任务ID: ${email.id}`,
            `收件人: ${email.to}`,
            `发送时间: ${new Date(email.scheduledAt).toLocaleString('zh-CN')}`,
        ].join('\n'));
    } catch (error) {
        await sendReply(ctx, event, `创建失败：${error instanceof Error ? error.message : String(error)}`);
    }

    return true;
}

/**
 * 删除定时邮件
 * 格式: #email scheduled delete <任务ID>
 */
async function handleScheduledDelete(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<boolean> {
    if (args.length < 1) {
        await sendReply(ctx, event, '请提供任务ID，格式：#email scheduled delete <任务ID>');
        return true;
    }

    const id = args[0];
    const success = deleteScheduledEmail(id);

    if (success) {
        await sendReply(ctx, event, '✅ 定时邮件任务已删除');
    } else {
        await sendReply(ctx, event, '❌ 任务不存在或删除失败');
    }

    return true;
}

/**
 * 取消定时邮件
 * 格式: #email scheduled cancel <任务ID>
 */
async function handleScheduledCancel(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<boolean> {
    if (args.length < 1) {
        await sendReply(ctx, event, '请提供任务ID，格式：#email scheduled cancel <任务ID>');
        return true;
    }

    const id = args[0];
    const success = cancelScheduledEmail(id);

    if (success) {
        await sendReply(ctx, event, '✅ 定时邮件任务已取消');
    } else {
        await sendReply(ctx, event, '❌ 任务不存在或取消失败');
    }

    return true;
}

/**
 * 立即执行定时邮件
 * 格式: #email scheduled exec <任务ID>
 */
async function handleScheduledExecute(
    ctx: NapCatPluginContext,
    event: OB11Message,
    args: string[]
): Promise<boolean> {
    if (args.length < 1) {
        await sendReply(ctx, event, '请提供任务ID，格式：#email scheduled exec <任务ID>');
        return true;
    }

    const id = args[0];
    const emails = getScheduledEmails();
    const email = emails.find(e => e.id === id);

    if (!email) {
        await sendReply(ctx, event, '❌ 任务不存在');
        return true;
    }

    await sendReply(ctx, event, `正在执行定时邮件任务：${email.name}...`);

    try {
        const result = await executeScheduledEmail(email);
        if (result.success) {
            await sendReply(ctx, event, `✅ ${result.message}`);
        } else {
            await sendReply(ctx, event, `❌ ${result.message}`);
        }
    } catch (error) {
        await sendReply(ctx, event, `❌ 执行失败：${error instanceof Error ? error.message : String(error)}`);
    }

    return true;
}

/**
 * 定时邮件帮助
 */
async function handleScheduledHelp(
    ctx: NapCatPluginContext,
    event: OB11Message
): Promise<boolean> {
    const prefix = pluginState.config.emailCommandPrefix || '#email';
    const helpText = [
        `[= 定时邮件命令 =]`,
        `${prefix} scheduled list - 查看定时邮件列表`,
        `${prefix} scheduled create <任务名称> <收件人> <主题> <内容> <时间> - 创建一次性定时邮件`,
        `${prefix} scheduled delete <任务ID> - 删除定时邮件`,
        `${prefix} scheduled cancel <任务ID> - 取消定时邮件`,
        `${prefix} scheduled exec <任务ID> - 立即执行定时邮件`,
        `${prefix} scheduled help - 显示此帮助`,
        ``,
        '示例：',
        `${prefix} scheduled create 每日日报 user@example.com 日报 这是今天的日报内容 2026-02-11T09:00:00`,
        ``,
        '时间格式：2026-02-11T09:00:00（ISO 8601格式）',
    ].join('\n');
    await sendReply(ctx, event, helpText);
    return true;
}
