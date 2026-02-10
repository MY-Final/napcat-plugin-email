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
import type { SendEmailParams } from '../types';
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

            ctx.logger.debug(`API收到发送邮件请求 - 收件人: ${recipients.join(', ')}`);

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
                return res.status(400).json({ code: -1, message: validation.message });
            }

            const result = await sendEmail({
                to: recipients.join(','),
                subject: body.subject,
                text: body.text,
                html: body.html,
                attachments: body.attachments,
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
            const body = req.body as { to?: string } | undefined;
            const testEmail = body?.to || pluginState.config.smtpUser;

            if (!testEmail) {
                return res.status(400).json({ code: -1, message: '请提供测试邮箱地址或配置发件人邮箱' });
            }

            // 先测试连接
            const connectionResult = await testSmtpConnection();
            if (!connectionResult.success) {
                return res.status(500).json({ code: -1, message: connectionResult.message });
            }

            // 发送测试邮件
            const result = await sendTestEmail(testEmail);
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

    // TODO: 在这里添加你的自定义 API 路由

    ctx.logger.debug('API 路由注册完成');
}
