/**
 * API 服务模块
 * 注册 WebUI API 路由
 *
 * 路由类型说明：
 * ┌─────────────────┬──────────────────────────────────────────────┬─────────────────┐
 * │ 类型            │ 路径前缀                                      │ 注册方法        │
 * ├─────────────────┼──────────────────────────────────────────────┼─────────────────┤
 * │ 需要鉴权 API    │ /api/Plugin/ext/<plugin-id>/                 │ router.get/post │
 * │ 无需鉴权 API    │ /plugin/<plugin-id>/api/                     │ router.getNoAuth│
 * │ 静态文件        │ /plugin/<plugin-id>/files/<urlPath>/         │ router.static   │
 * │ 内存文件        │ /plugin/<plugin-id>/mem/<urlPath>/           │ router.staticOnMem│
 * │ 页面            │ /plugin/<plugin-id>/page/<path>             │ router.page     │
 * └─────────────────┴──────────────────────────────────────────────┴─────────────────┘
 *
 * 一般插件自带的 WebUI 页面使用 NoAuth 路由，因为页面本身已在 NapCat WebUI 内嵌展示。
 */

import type {
    NapCatPluginContext,
    PluginHttpRequest,
    PluginHttpResponse
} from 'napcat-types/napcat-onebot/network/plugin/types';
import { pluginState } from '../core/state';
import { sendEmail, sendTestEmail, testSmtpConnection, validateSmtpConfig } from './email-service';
import type { SendEmailParams, CreateScheduledEmailParams, UpdateScheduledEmailParams, CreateEmailAccountParams, UpdateEmailAccountParams } from '../types';
import {
    getScheduledEmails,
    getScheduledEmailById,
    createScheduledEmail,
    updateScheduledEmail,
    deleteScheduledEmail,
    cancelScheduledEmail,
    executeScheduledEmail,
    validateScheduledEmailParams,
} from './scheduled-email-service';
import { emailHistoryService } from './email-history-service';
import fs from 'fs';
import path from 'path';

/**
 * 注册 API 路由
 */
export function registerApiRoutes(ctx: NapCatPluginContext): void {
    const router = ctx.router;

    // ==================== 插件信息（无鉴权）====================

    /** 获取插件状态 */
    router.getNoAuth('/status', (_req, res) => {
        res.json({
            code: 0,
            data: {
                pluginName: ctx.pluginName,
                uptime: pluginState.getUptime(),
                uptimeFormatted: pluginState.getUptimeFormatted(),
                config: pluginState.config,
                stats: pluginState.stats,
            },
        });
    });

    // ==================== 配置管理（无鉴权）====================

    /** 获取配置 */
    router.getNoAuth('/config', (_req, res) => {
        res.json({ code: 0, data: pluginState.config });
    });

    /** 保存配置 */
    router.postNoAuth('/config', async (req, res) => {
        try {
            const body = req.body as Record<string, unknown> | undefined;
            if (!body) {
                return res.status(400).json({ code: -1, message: '请求体为空' });
            }
            pluginState.updateConfig(body as Partial<import('../types').PluginConfig>);
            ctx.logger.info('配置已保存');
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            ctx.logger.error('保存配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // ==================== 邮箱账号管理（无鉴权）====================

    /** 获取所有邮箱账号 */
    router.getNoAuth('/email/accounts', (_req, res) => {
        try {
            const accounts = pluginState.getEmailAccounts();
            res.json({ code: 0, data: accounts });
        } catch (err) {
            ctx.logger.error('获取邮箱账号列表失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 获取单个邮箱账号 */
    router.getNoAuth('/email/accounts/:id', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少账号 ID' });
            }

            const account = pluginState.getEmailAccountById(id);
            if (!account) {
                return res.status(404).json({ code: -1, message: '邮箱账号不存在' });
            }

            res.json({ code: 0, data: account });
        } catch (err) {
            ctx.logger.error('获取邮箱账号失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 获取默认邮箱账号 */
    router.getNoAuth('/email/accounts/default', (_req, res) => {
        try {
            const account = pluginState.getDefaultEmailAccount();
            res.json({ code: 0, data: account });
        } catch (err) {
            ctx.logger.error('获取默认邮箱账号失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 创建邮箱账号 */
    router.postNoAuth('/email/accounts', async (req, res) => {
        try {
            const body = req.body as CreateEmailAccountParams | undefined;
            if (!body) {
                return res.status(400).json({ code: -1, message: '请求体为空' });
            }

            // 验证必填字段
            if (!body.name || !body.host || !body.user || !body.pass) {
                return res.status(400).json({ code: -1, message: '请填写完整的账号信息' });
            }

            // 验证端口
            if (!body.port || body.port <= 0 || body.port > 65535) {
                return res.status(400).json({ code: -1, message: 'SMTP 端口无效' });
            }

            const account = pluginState.createEmailAccount(body);
            ctx.logger.info(`创建邮箱账号: ${account.name} (${account.id})`);
            res.json({ code: 0, data: account });
        } catch (err) {
            ctx.logger.error('创建邮箱账号失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 更新邮箱账号 */
    router.putNoAuth('/email/accounts/:id', async (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少账号 ID' });
            }

            const body = req.body as UpdateEmailAccountParams | undefined;
            if (!body) {
                return res.status(400).json({ code: -1, message: '请求体为空' });
            }

            const account = pluginState.updateEmailAccount(id, body);
            if (!account) {
                return res.status(404).json({ code: -1, message: '邮箱账号不存在' });
            }

            ctx.logger.info(`更新邮箱账号: ${account.name} (${account.id})`);
            res.json({ code: 0, data: account });
        } catch (err) {
            ctx.logger.error('更新邮箱账号失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 删除邮箱账号 */
    router.deleteNoAuth('/email/accounts/:id', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少账号 ID' });
            }

            const success = pluginState.deleteEmailAccount(id);
            if (!success) {
                return res.status(404).json({ code: -1, message: '邮箱账号不存在' });
            }

            ctx.logger.info(`删除邮箱账号: ${id}`);
            res.json({ code: 0, message: '删除成功' });
        } catch (err) {
            ctx.logger.error('删除邮箱账号失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 设为默认邮箱账号 */
    router.postNoAuth('/email/accounts/:id/default', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少账号 ID' });
            }

            const success = pluginState.setDefaultEmailAccount(id);
            if (!success) {
                return res.status(404).json({ code: -1, message: '邮箱账号不存在' });
            }

            ctx.logger.info(`设置默认邮箱账号: ${id}`);
            res.json({ code: 0, message: '设置成功' });
        } catch (err) {
            ctx.logger.error('设置默认邮箱账号失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 测试指定账号的 SMTP 连接 */
    router.postNoAuth('/email/accounts/:id/test', async (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少账号 ID' });
            }

            const account = pluginState.getEmailAccountById(id);
            if (!account) {
                return res.status(404).json({ code: -1, message: '邮箱账号不存在' });
            }

            const result = await testSmtpConnection(id);
            if (result.success) {
                res.json({ code: 0, message: result.message });
            } else {
                res.status(500).json({ code: -1, message: result.message });
            }
        } catch (err) {
            ctx.logger.error('测试邮箱账号连接失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // ==================== 群管理（无鉴权）====================

    /** 获取群列表（附带各群启用状态） */
    router.getNoAuth('/groups', async (_req, res) => {
        try {
            const groups = await ctx.actions.call(
                'get_group_list',
                {},
                ctx.adapterName,
                ctx.pluginManager.config
            ) as Array<{ group_id: number; group_name: string; member_count: number; max_member_count: number }>;

            const groupsWithConfig = (groups || []).map((group) => {
                const groupId = String(group.group_id);
                return {
                    group_id: group.group_id,
                    group_name: group.group_name,
                    member_count: group.member_count,
                    max_member_count: group.max_member_count,
                    enabled: pluginState.isGroupEnabled(groupId),
                };
            });

            res.json({ code: 0, data: groupsWithConfig });
        } catch (e) {
            ctx.logger.error('获取群列表失败:', e);
            res.status(500).json({ code: -1, message: String(e) });
        }
    });

    /** 更新单个群配置 */
    router.postNoAuth('/groups/:id/config', async (req, res) => {
        try {
            const groupId = req.params?.id;
            if (!groupId) {
                return res.status(400).json({ code: -1, message: '缺少群 ID' });
            }

            const body = req.body as Record<string, unknown> | undefined;
            const enabled = body?.enabled;
            pluginState.updateGroupConfig(groupId, { enabled: Boolean(enabled) });
            ctx.logger.info(`群 ${groupId} 配置已更新: enabled=${enabled}`);
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            ctx.logger.error('更新群配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 批量更新群配置 */
    router.postNoAuth('/groups/bulk-config', async (req, res) => {
        try {
            const body = req.body as Record<string, unknown> | undefined;
            const { enabled, groupIds } = body || {};

            if (typeof enabled !== 'boolean' || !Array.isArray(groupIds)) {
                return res.status(400).json({ code: -1, message: '参数错误' });
            }

            for (const groupId of groupIds) {
                pluginState.updateGroupConfig(String(groupId), { enabled });
            }

            ctx.logger.info(`批量更新群配置完成 | 数量: ${groupIds.length}, enabled=${enabled}`);
            res.json({ code: 0, message: 'ok' });
        } catch (err) {
            ctx.logger.error('批量更新群配置失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // ==================== 邮箱服务（无鉴权）====================

    /** 获取 SMTP 配置 */
    router.getNoAuth('/email/config', (_req, res) => {
        const cfg = pluginState.config;
        // 不返回授权码
        res.json({
            code: 0,
            data: {
                host: cfg.smtpHost,
                port: cfg.smtpPort,
                user: cfg.smtpUser,
                senderName: cfg.smtpSenderName,
                subjectPrefix: cfg.smtpSubjectPrefix,
                secure: cfg.smtpSecure,
            }
        });
    });

    /** 发送邮件 */
    router.postNoAuth('/email/send', async (req, res) => {
        try {
            const body = req.body as Partial<SendEmailParams> | undefined;
            if (!body?.to || !body?.subject) {
                return res.status(400).json({ code: -1, message: '缺少必要参数: to, subject' });
            }

            // 验证收件人格式
            const recipients = body.to.split(',').map(r => r.trim()).filter(r => r);
            if (recipients.length === 0) {
                return res.status(400).json({ code: -1, message: '收件人邮箱地址无效' });
            }

            // 验证每个收件人
            const invalidRecipients = recipients.filter(r => !r.includes('@'));
            if (invalidRecipients.length > 0) {
                return res.status(400).json({ code: -1, message: `无效的收件人邮箱: ${invalidRecipients.join(', ')}` });
            }

            ctx.logger.debug(`API收到发送邮件请求 - 收件人: ${recipients.join(', ')}, 账号: ${body.accountId || '默认'}`);

            // 验证账号（如果指定了）
            if (body.accountId) {
                const account = pluginState.getEmailAccountById(body.accountId);
                if (!account) {
                    return res.status(400).json({ code: -1, message: '邮箱账号不存在' });
                }
            }

            const result = await sendEmail({
                accountId: body.accountId,
                to: recipients.join(','),
                subject: body.subject,
                text: body.text,
                html: body.html,
                attachments: body.attachments,
            });

            // 保存历史记录
            emailHistoryService.addRecord({
                sendType: 'manual',
                accountId: result.accountId || body.accountId || '',
                to: recipients.join(','),
                subject: body.subject,
                text: body.text,
                html: body.html,
                status: result.success ? 'success' : 'failed',
                errorMessage: result.success ? undefined : result.message,
                attachmentCount: body.attachments?.length || 0,
                attachments: body.attachments?.map(att => ({ filename: att.filename, contentType: att.contentType })),
            });

            if (result.success) {
                res.json({ code: 0, message: result.message });
            } else {
                res.status(500).json({ code: -1, message: result.message });
            }
        } catch (err) {
            ctx.logger.error('发送邮件失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 上传附件（临时存储） */
    router.postNoAuth('/email/upload', async (req, res) => {
        try {
            const body = req.body as { filename?: string; content?: string } | undefined;
            if (!body?.filename || !body?.content) {
                return res.status(400).json({ code: -1, message: '缺少必要参数: filename, content' });
            }

            // 创建临时目录
            const tempDir = path.join(ctx.dataPath, 'temp_attachments');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // 生成唯一文件名
            const timestamp = Date.now();
            const safeFilename = body.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
            const tempFilePath = path.join(tempDir, `${timestamp}_${safeFilename}`);

            // 保存 base64 内容到临时文件
            const buffer = Buffer.from(body.content, 'base64');
            fs.writeFileSync(tempFilePath, buffer);

            // 返回临时文件路径（供后续发送邮件使用）
            res.json({
                code: 0,
                data: {
                    path: tempFilePath,
                    filename: body.filename,
                    size: buffer.length,
                },
            });
        } catch (err) {
            ctx.logger.error('上传附件失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 测试 SMTP 配置 */
    router.postNoAuth('/email/test', async (req, res) => {
        try {
            const body = req.body as { to?: string; accountId?: string } | undefined;
            const testEmail = body?.to;
            const accountId = body?.accountId;

            // 验证账号（如果指定了）
            if (accountId) {
                const account = pluginState.getEmailAccountById(accountId);
                if (!account) {
                    return res.status(400).json({ code: -1, message: '邮箱账号不存在' });
                }
            } else if (pluginState.getEmailAccounts().length === 0) {
                return res.status(400).json({ code: -1, message: '请先配置邮箱账号' });
            }

            // 先测试连接
            const connectionResult = await testSmtpConnection(accountId);
            if (!connectionResult.success) {
                return res.status(500).json({ code: -1, message: connectionResult.message });
            }

            // 如果没有提供测试邮箱，使用账号的邮箱地址
            const targetEmail = testEmail || pluginState.getEmailAccountById(accountId || '')?.user;
            if (!targetEmail) {
                return res.status(400).json({ code: -1, message: '请提供测试邮箱地址' });
            }

            // 发送测试邮件
            const result = await sendTestEmail(targetEmail, accountId);

            // 保存历史记录
            emailHistoryService.addRecord({
                sendType: 'test',
                accountId: accountId || pluginState.getDefaultEmailAccount()?.id || '',
                to: targetEmail,
                subject: 'SMTP 配置测试',
                text: `这是一封测试邮件，用于验证 SMTP 配置是否正确。\n\n发送时间: ${new Date().toLocaleString('zh-CN')}`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px;">
                        <h2 style="color: #4CAF50;">SMTP 配置测试</h2>
                        <p>这是一封测试邮件，用于验证 SMTP 配置是否正确。</p>
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        <p style="color: #666; font-size: 12px;">发送时间: ${new Date().toLocaleString('zh-CN')}</p>
                    </div>
                `,
                status: result.success ? 'success' : 'failed',
                errorMessage: result.success ? undefined : result.message,
                attachmentCount: 0,
            });

            if (result.success) {
                res.json({ code: 0, message: result.message });
            } else {
                res.status(500).json({ code: -1, message: result.message });
            }
        } catch (err) {
            ctx.logger.error('测试邮件失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // ==================== 定时邮件管理（无鉴权）====================

    /** 获取所有定时邮件任务 */
    router.getNoAuth('/scheduled-emails', (_req, res) => {
        try {
            const emails = getScheduledEmails();
            res.json({ code: 0, data: emails });
        } catch (err) {
            ctx.logger.error('获取定时邮件列表失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 获取单个定时邮件任务 */
    router.getNoAuth('/scheduled-emails/:id', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少任务 ID' });
            }

            const email = getScheduledEmailById(id);
            if (!email) {
                return res.status(404).json({ code: -1, message: '定时邮件任务不存在' });
            }

            res.json({ code: 0, data: email });
        } catch (err) {
            ctx.logger.error('获取定时邮件任务失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 创建定时邮件任务 */
    router.postNoAuth('/scheduled-emails', async (req, res) => {
        try {
            const body = req.body as CreateScheduledEmailParams | undefined;
            if (!body) {
                return res.status(400).json({ code: -1, message: '请求体为空' });
            }

            // 验证参数
            const validation = validateScheduledEmailParams(body);
            if (!validation.valid) {
                return res.status(400).json({ code: -1, message: validation.message });
            }

            const email = createScheduledEmail(body);
            ctx.logger.info(`创建定时邮件任务: ${email.name} (${email.id})`);
            res.json({ code: 0, data: email });
        } catch (err) {
            ctx.logger.error('创建定时邮件任务失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 更新定时邮件任务 */
    router.putNoAuth('/scheduled-emails/:id', async (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少任务 ID' });
            }

            const body = req.body as UpdateScheduledEmailParams | undefined;
            if (!body) {
                return res.status(400).json({ code: -1, message: '请求体为空' });
            }

            const email = updateScheduledEmail(id, body);
            if (!email) {
                return res.status(404).json({ code: -1, message: '定时邮件任务不存在' });
            }

            ctx.logger.info(`更新定时邮件任务: ${email.name} (${email.id})`);
            res.json({ code: 0, data: email });
        } catch (err) {
            ctx.logger.error('更新定时邮件任务失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 删除定时邮件任务 */
    router.deleteNoAuth('/scheduled-emails/:id', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少任务 ID' });
            }

            const success = deleteScheduledEmail(id);
            if (!success) {
                return res.status(404).json({ code: -1, message: '定时邮件任务不存在' });
            }

            ctx.logger.info(`删除定时邮件任务: ${id}`);
            res.json({ code: 0, message: '删除成功' });
        } catch (err) {
            ctx.logger.error('删除定时邮件任务失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 取消定时邮件任务 */
    router.postNoAuth('/scheduled-emails/:id/cancel', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少任务 ID' });
            }

            const success = cancelScheduledEmail(id);
            if (!success) {
                return res.status(404).json({ code: -1, message: '定时邮件任务不存在' });
            }

            ctx.logger.info(`取消定时邮件任务: ${id}`);
            res.json({ code: 0, message: '取消成功' });
        } catch (err) {
            ctx.logger.error('取消定时邮件任务失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 立即执行定时邮件任务 */
    router.postNoAuth('/scheduled-emails/:id/execute', async (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少任务 ID' });
            }

            const email = getScheduledEmailById(id);
            if (!email) {
                return res.status(404).json({ code: -1, message: '定时邮件任务不存在' });
            }

            ctx.logger.info(`手动执行定时邮件任务: ${email.name} (${email.id})`);
            const result = await executeScheduledEmail(email);

            if (result.success) {
                res.json({ code: 0, message: result.message });
            } else {
                res.status(500).json({ code: -1, message: result.message });
            }
        } catch (err) {
            ctx.logger.error('执行定时邮件任务失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // ==================== 邮件历史记录（无鉴权）====================

    /** 获取邮件发送历史 */
    router.getNoAuth('/email/history', (req, res) => {
        try {
            const query = req.query as Record<string, string>;
            const page = parseInt(query.page || '1', 10);
            const pageSize = parseInt(query.pageSize || '20', 10);
            const sendType = query.sendType as import('../types').EmailSendType | undefined;
            const status = query.status as import('../types').EmailSendStatus | undefined;

            const result = emailHistoryService.getHistory({
                page,
                pageSize,
                sendType,
                status,
            });

            res.json({ code: 0, data: result });
        } catch (err) {
            ctx.logger.error('获取邮件历史记录失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 获取邮件发送统计 */
    router.getNoAuth('/email/stats', (_req, res) => {
        try {
            const stats = emailHistoryService.getStats();
            const todayStats = emailHistoryService.getTodayStats();

            res.json({
                code: 0,
                data: {
                    total: stats,
                    today: todayStats,
                },
            });
        } catch (err) {
            ctx.logger.error('获取邮件发送统计失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 删除单条历史记录 */
    router.deleteNoAuth('/email/history/:id', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少记录 ID' });
            }

            const success = emailHistoryService.deleteRecord(id);
            if (!success) {
                return res.status(404).json({ code: -1, message: '记录不存在' });
            }

            res.json({ code: 0, message: '删除成功' });
        } catch (err) {
            ctx.logger.error('删除邮件历史记录失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 清空历史记录 */
    router.postNoAuth('/email/history/clear', (_req, res) => {
        try {
            emailHistoryService.clearHistory();
            res.json({ code: 0, message: '历史记录已清空' });
        } catch (err) {
            ctx.logger.error('清空邮件历史记录失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    /** 获取单条邮件详情 */
    router.getNoAuth('/email/history/:id', (req, res) => {
        try {
            const id = req.params?.id;
            if (!id) {
                return res.status(400).json({ code: -1, message: '缺少记录 ID' });
            }

            const record = emailHistoryService.getRecordById(id);
            if (!record) {
                return res.status(404).json({ code: -1, message: '记录不存在' });
            }

            res.json({ code: 0, data: record });
        } catch (err) {
            ctx.logger.error('获取邮件详情失败:', err);
            res.status(500).json({ code: -1, message: String(err) });
        }
    });

    // TODO: 在这里添加你的自定义 API 路由

    ctx.logger.debug('API 路由注册完成');
}
