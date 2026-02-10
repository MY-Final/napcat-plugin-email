/**
 * 插件配置模块
 * 定义默认配置值和 WebUI 配置 Schema
 */

import type { NapCatPluginContext, PluginConfigSchema } from 'napcat-types/napcat-onebot/network/plugin/types';
import type { PluginConfig, SmtpConfig } from './types';

/** 默认配置 */
export const DEFAULT_CONFIG: PluginConfig = {
    enabled: true,
    debug: false,
    commandPrefix: '#cmd',
    cooldownSeconds: 60,
    groupConfigs: {},
    emailCommandPrefix: '#email',
    smtpHost: '',
    smtpPort: 465,
    smtpUser: '',
    smtpPass: '',
    smtpSenderName: 'QQ Bot',
    smtpSubjectPrefix: '[QQ Bot]',
    smtpSecure: true,
};

/**
 * 构建 WebUI 配置 Schema
 *
 * 使用 ctx.NapCatConfig 提供的构建器方法生成配置界面：
 *   - boolean(key, label, defaultValue?, description?, reactive?)  → 开关
 *   - text(key, label, defaultValue?, description?, reactive?)     → 文本输入
 *   - number(key, label, defaultValue?, description?, reactive?)   → 数字输入
 *   - select(key, label, options, defaultValue?, description?)     → 下拉单选
 *   - multiSelect(key, label, options, defaultValue?, description?) → 下拉多选
 *   - html(content)     → 自定义 HTML 展示（不保存值）
 *   - plainText(content) → 纯文本说明
 *   - combine(...items)  → 组合多个配置项为 Schema
 */
export function buildConfigSchema(ctx: NapCatPluginContext): PluginConfigSchema {
    return ctx.NapCatConfig.combine(
        // 插件信息头部
        ctx.NapCatConfig.html(`
            <div style="padding: 16px; background: #FB7299; border-radius: 12px; margin-bottom: 20px; color: white;">
                <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">插件模板</h3>
                <p style="margin: 0; font-size: 13px; opacity: 0.85;">NapCat 插件开发模板，请根据需要修改配置</p>
            </div>
        `),
        // 全局开关
        ctx.NapCatConfig.boolean('enabled', '启用插件', true, '是否启用此插件的功能'),
        // 调试模式
        ctx.NapCatConfig.boolean('debug', '调试模式', false, '启用后将输出详细的调试日志'),
        // 命令前缀
        ctx.NapCatConfig.text('commandPrefix', '命令前缀', '#cmd', '触发命令的前缀，默认为 #cmd'),
        // 冷却时间
        ctx.NapCatConfig.number('cooldownSeconds', '冷却时间（秒）', 60, '同一命令请求冷却时间，0 表示不限制'),

        // SMTP 配置
        ctx.NapCatConfig.html(`
            <div style="padding: 16px; background: #4CAF50; border-radius: 12px; margin: 20px 0; color: white;">
                <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 600;">邮箱服务配置</h3>
                <p style="margin: 0; font-size: 13px; opacity: 0.85;">配置 SMTP 服务器以发送邮件</p>
            </div>
        `),
        // 邮件命令前缀
        ctx.NapCatConfig.text('emailCommandPrefix', '邮件命令前缀', '#email', '触发邮件命令的前缀，默认为 #email'),
        // SMTP 服务器配置
        ctx.NapCatConfig.text('smtpHost', 'SMTP 服务器地址', '', 'SMTP 服务器地址，如 smtp.qq.com'),
        ctx.NapCatConfig.number('smtpPort', 'SMTP 端口', 465, 'SMTP 服务器端口，通常为 465 或 587'),
        ctx.NapCatConfig.text('smtpUser', '邮箱账号', '', '用于发送邮件的邮箱账号'),
        ctx.NapCatConfig.text('smtpPass', 'SMTP 授权码', '', '邮箱的 SMTP 授权码（非邮箱密码）'),
        ctx.NapCatConfig.text('smtpSenderName', '发件人名称', 'QQ Bot', '显示在邮件中的发件人名称'),
        ctx.NapCatConfig.text('smtpSubjectPrefix', '邮件标题前缀', '[QQ Bot]', '邮件标题的前缀'),
        ctx.NapCatConfig.boolean('smtpSecure', '使用 SSL/TLS 加密', true, '是否使用 SSL/TLS 加密连接')
    );
}
