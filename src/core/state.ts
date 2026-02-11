/**
 * 全局状态管理模块（单例模式）
 *
 * 封装插件的配置持久化和运行时状态，提供在项目任意位置访问
 * ctx、config、logger 等对象的能力，无需逐层传递参数。
 *
 * 使用方法：
 *   import { pluginState } from '../core/state';
 *   pluginState.config.enabled;       // 读取配置
 *   pluginState.ctx.logger.info(...); // 使用日志
 */

import fs from 'fs';
import path from 'path';
import type { NapCatPluginContext, PluginLogger } from 'napcat-types/napcat-onebot/network/plugin/types';
import { DEFAULT_CONFIG } from '../config';
import type { PluginConfig, GroupConfig, EmailAccount, CreateEmailAccountParams, UpdateEmailAccountParams } from '../types';
import { emailHistoryService } from '../services/email-history-service';

// ==================== 配置清洗工具 ====================

function isObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 配置清洗函数
 * 确保从文件读取的配置符合预期类型，防止运行时错误
 */
function sanitizeConfig(raw: unknown): PluginConfig {
    if (!isObject(raw)) return { ...DEFAULT_CONFIG, groupConfigs: {}, emailAccounts: [], defaultAccountId: null };

    const out: PluginConfig = {
        ...DEFAULT_CONFIG,
        groupConfigs: {},
        emailAccounts: [],
        defaultAccountId: null,
    };

    // 群配置清洗
    if (isObject(raw.groupConfigs)) {
        for (const [groupId, groupConfig] of Object.entries(raw.groupConfigs)) {
            if (isObject(groupConfig)) {
                const cfg: GroupConfig = {};
                if (typeof groupConfig.enabled === 'boolean') cfg.enabled = groupConfig.enabled;
                out.groupConfigs[groupId] = cfg;
            }
        }
    }

    // 邮件命令前缀清洗
    if (typeof raw.emailCommandPrefix === 'string') {
        out.emailCommandPrefix = raw.emailCommandPrefix;
    }

    // 邮箱账号列表清洗（多账号支持）
    if (Array.isArray(raw.emailAccounts)) {
        out.emailAccounts = raw.emailAccounts.map((account: unknown) => {
            if (!isObject(account)) return null;
            return {
                id: String(account.id || generateAccountId()),
                name: String(account.name || '未命名账号'),
                isDefault: Boolean(account.isDefault),
                host: String(account.host || ''),
                port: Number(account.port) || 465,
                user: String(account.user || ''),
                pass: String(account.pass || ''),
                senderName: String(account.senderName || ''),
                subjectPrefix: String(account.subjectPrefix || ''),
                secure: Boolean(account.secure),
                createdAt: String(account.createdAt || new Date().toISOString()),
                updatedAt: String(account.updatedAt || new Date().toISOString()),
            };
        }).filter(Boolean) as EmailAccount[];
    }

    // 默认账号 ID 清洗
    if (typeof raw.defaultAccountId === 'string') {
        out.defaultAccountId = raw.defaultAccountId;
    }

    // 旧版 SMTP 配置清洗（用于迁移）
    if (typeof raw.smtpHost === 'string' && typeof raw.smtpUser === 'string') {
        out.smtpHost = raw.smtpHost;
        out.smtpPort = Number(raw.smtpPort) || 465;
        out.smtpUser = raw.smtpUser;
        out.smtpPass = String(raw.smtpPass || '');
        out.smtpSenderName = String(raw.smtpSenderName || '');
        out.smtpSubjectPrefix = String(raw.smtpSubjectPrefix || '');
        out.smtpSecure = Boolean(raw.smtpSecure);

        // 如果没有邮箱账号列表，且有旧版配置，则迁移旧配置
        if (out.emailAccounts.length === 0 && raw.smtpHost && raw.smtpUser) {
            const migratedAccount: EmailAccount = {
                id: generateAccountId(),
                name: raw.smtpSenderName || raw.smtpUser,
                isDefault: true,
                host: raw.smtpHost,
                port: Number(raw.smtpPort) || 465,
                user: raw.smtpUser,
                pass: String(raw.smtpPass || ''),
                senderName: String(raw.smtpSenderName || ''),
                subjectPrefix: String(raw.smtpSubjectPrefix || ''),
                secure: Boolean(raw.smtpSecure),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            out.emailAccounts.push(migratedAccount);
            out.defaultAccountId = migratedAccount.id;
        }
    }

    return out;
}

/**
 * 生成邮箱账号唯一 ID
 */
function generateAccountId(): string {
    return `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== 插件全局状态类 ====================

class PluginState {
    /** NapCat 插件上下文（init 后可用） */
    private _ctx: NapCatPluginContext | null = null;

    /** 插件配置 */
    config: PluginConfig = { ...DEFAULT_CONFIG };

    /** 插件启动时间戳 */
    startTime: number = 0;

    /** 机器人自身 QQ 号 */
    selfId: string = '';

    /** 活跃的定时器 Map: jobId -> NodeJS.Timeout */
    timers: Map<string, ReturnType<typeof setInterval>> = new Map();

    /** 运行时统计 */
    stats = {
        processed: 0,
        todayProcessed: 0,
        lastUpdateDay: new Date().toDateString(),
    };

    /** 获取上下文（确保已初始化） */
    get ctx(): NapCatPluginContext {
        if (!this._ctx) throw new Error('PluginState 尚未初始化，请先调用 init()');
        return this._ctx;
    }

    /** 获取日志器的快捷方式 */
    get logger(): PluginLogger {
        return this.ctx.logger;
    }

    // ==================== 生命周期 ====================

    /**
     * 初始化（在 plugin_init 中调用）
     */
    init(ctx: NapCatPluginContext): void {
        this._ctx = ctx;
        this.startTime = Date.now();
        this.loadConfig();
        this.ensureDataDir();
        this.fetchSelfId();
        this.startScheduledEmailChecker();
        emailHistoryService.init(ctx.dataPath);
    }

    /**
     * 获取机器人自身 QQ 号（异步，init 时自动调用）
     */
    private async fetchSelfId(): Promise<void> {
        try {
            const res = await this.ctx.actions.call(
                'get_login_info', {}, this.ctx.adapterName, this.ctx.pluginManager.config
            ) as { user_id?: number | string };
            if (res?.user_id) {
                this.selfId = String(res.user_id);
                this.logger.debug("(｡·ω·｡) 机器人 QQ: " + this.selfId);
            }
        } catch (e) {
            this.logger.warn("(；′⌒`) 获取机器人 QQ 号失败:", e);
        }
    }

    /**
     * 清理（在 plugin_cleanup 中调用）
     */
    cleanup(): void {
        // 停止定时邮件检查器
        this.stopScheduledEmailChecker();
        
        // 清理所有定时器
        for (const [jobId, timer] of this.timers) {
            clearInterval(timer);
            this.logger.debug(`(｡-ω-) 清理定时器: ${jobId}`);
        }
        this.timers.clear();
        this.saveConfig();
        this._ctx = null;
    }

    // ==================== 数据目录 ====================

    /** 确保数据目录存在 */
    private ensureDataDir(): void {
        const dataPath = this.ctx.dataPath;
        if (!fs.existsSync(dataPath)) {
            fs.mkdirSync(dataPath, { recursive: true });
        }
    }

    /** 获取数据文件完整路径 */
    getDataFilePath(filename: string): string {
        return path.join(this.ctx.dataPath, filename);
    }

    // ==================== 通用数据文件读写 ====================

    /**
     * 读取 JSON 数据文件
     * 常用于订阅数据、定时任务配置、推送历史等持久化数据
     * @param filename 数据文件名（如 'subscriptions.json'）
     * @param defaultValue 文件不存在或解析失败时的默认值
     */
    loadDataFile<T>(filename: string, defaultValue: T): T {
        const filePath = this.getDataFilePath(filename);
        try {
            if (fs.existsSync(filePath)) {
                return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }
        } catch (e) {
            this.logger.warn("(；′⌒`) 读取数据文件 " + filename + " 失败:", e);
        }
        return defaultValue;
    }

    /**
     * 保存 JSON 数据文件
     * @param filename 数据文件名
     * @param data 要保存的数据
     */
    saveDataFile<T>(filename: string, data: T): void {
        const filePath = this.getDataFilePath(filename);
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (e) {
            this.logger.error("(╥﹏╥) 保存数据文件 " + filename + " 失败:", e);
        }
    }

    // ==================== 配置管理 ====================

    /**
     * 从磁盘加载配置
     */
    loadConfig(): void {
        const configPath = this.ctx.configPath;
        try {
            if (configPath && fs.existsSync(configPath)) {
                const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                this.config = sanitizeConfig(raw);
                // 加载统计信息
                if (isObject(raw) && isObject(raw.stats)) {
                    Object.assign(this.stats, raw.stats);
                }
                this.ctx.logger.debug('已加载本地配置');
            } else {
                this.config = { ...DEFAULT_CONFIG, groupConfigs: {} };
                this.saveConfig();
                this.ctx.logger.debug('配置文件不存在，已创建默认配置');
            }
        } catch (error) {
            this.ctx.logger.error('加载配置失败，使用默认配置:', error);
            this.config = { ...DEFAULT_CONFIG, groupConfigs: {} };
        }
    }

    /**
     * 保存配置到磁盘
     */
    saveConfig(): void {
        if (!this._ctx) return;
        const configPath = this._ctx.configPath;
        try {
            const configDir = path.dirname(configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            const data = { ...this.config, stats: this.stats };
            fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (error) {
            this._ctx.logger.error('保存配置失败:', error);
        }
    }

    /**
     * 合并更新配置
     */
    updateConfig(partial: Partial<PluginConfig>): void {
        this.config = { ...this.config, ...partial };
        this.saveConfig();
    }

    /**
     * 完整替换配置
     */
    replaceConfig(config: PluginConfig): void {
        this.config = sanitizeConfig(config);
        this.saveConfig();
    }

    /**
     * 更新指定群的配置
     */
    updateGroupConfig(groupId: string, config: Partial<GroupConfig>): void {
        this.config.groupConfigs[groupId] = {
            ...this.config.groupConfigs[groupId],
            ...config,
        };
        this.saveConfig();
    }

    /**
     * 检查群是否启用（默认启用，除非明确设置为 false）
     */
    isGroupEnabled(groupId: string): boolean {
        return this.config.groupConfigs[groupId]?.enabled !== false;
    }

    // ==================== 邮箱账号管理 ====================

    /**
     * 获取所有邮箱账号
     */
    getEmailAccounts(): EmailAccount[] {
        return this.config.emailAccounts || [];
    }

    /**
     * 获取邮箱账号（根据 ID）
     */
    getEmailAccountById(id: string): EmailAccount | undefined {
        return this.getEmailAccounts().find(account => account.id === id);
    }

    /**
     * 获取默认邮箱账号
     */
    getDefaultEmailAccount(): EmailAccount | undefined {
        const accounts = this.getEmailAccounts();
        if (accounts.length === 0) return undefined;

        // 如果有设置默认账号，优先返回
        if (this.config.defaultAccountId) {
            const defaultAccount = accounts.find(a => a.id === this.config.defaultAccountId);
            if (defaultAccount) return defaultAccount;
        }

        // 否则返回第一个账号
        return accounts[0];
    }

    /**
     * 创建邮箱账号
     */
    createEmailAccount(params: CreateEmailAccountParams): EmailAccount {
        const now = new Date().toISOString();
        const isFirstAccount = this.getEmailAccounts().length === 0;

        const account: EmailAccount = {
            id: generateAccountId(),
            name: params.name,
            isDefault: params.isDefault ?? isFirstAccount,
            host: params.host,
            port: params.port,
            user: params.user,
            pass: params.pass,
            senderName: params.senderName,
            subjectPrefix: params.subjectPrefix,
            secure: params.secure,
            createdAt: now,
            updatedAt: now,
        };

        // 确保 emailAccounts 数组存在
        if (!this.config.emailAccounts) {
            this.config.emailAccounts = [];
        }

        // 如果设为默认账号，取消其他账号的默认状态
        if (account.isDefault) {
            for (const acc of this.config.emailAccounts) {
                acc.isDefault = false;
            }
            this.config.defaultAccountId = account.id;
        }

        this.config.emailAccounts.push(account);
        this.saveConfig();

        this.logger.info(`创建邮箱账号: ${account.name} (${account.id})`);
        return account;
    }

    /**
     * 更新邮箱账号
     */
    updateEmailAccount(id: string, params: UpdateEmailAccountParams): EmailAccount | null {
        // 确保 emailAccounts 数组存在
        if (!this.config.emailAccounts) {
            this.config.emailAccounts = [];
        }

        const index = this.config.emailAccounts.findIndex(a => a.id === id);
        if (index === -1) return null;

        const account = this.config.emailAccounts[index];

        // 如果设为默认账号，取消其他账号的默认状态
        if (params.isDefault) {
            for (const acc of this.config.emailAccounts) {
                acc.isDefault = false;
            }
            this.config.defaultAccountId = id;
        }

        // 更新字段
        if (params.name !== undefined) account.name = params.name;
        if (params.host !== undefined) account.host = params.host;
        if (params.port !== undefined) account.port = params.port;
        if (params.user !== undefined) account.user = params.user;
        if (params.pass !== undefined) account.pass = params.pass;
        if (params.senderName !== undefined) account.senderName = params.senderName;
        if (params.subjectPrefix !== undefined) account.subjectPrefix = params.subjectPrefix;
        if (params.secure !== undefined) account.secure = params.secure;
        if (params.isDefault !== undefined) account.isDefault = params.isDefault;

        account.updatedAt = new Date().toISOString();

        this.config.emailAccounts[index] = account;
        this.saveConfig();

        this.logger.info(`更新邮箱账号: ${account.name} (${account.id})`);
        return account;
    }

    /**
     * 删除邮箱账号
     */
    deleteEmailAccount(id: string): boolean {
        // 确保 emailAccounts 数组存在
        if (!this.config.emailAccounts) {
            this.config.emailAccounts = [];
        }

        const index = this.config.emailAccounts.findIndex(a => a.id === id);
        if (index === -1) return false;

        const account = this.config.emailAccounts[index];
        this.config.emailAccounts.splice(index, 1);

        // 如果删除的是默认账号，设置新的默认账号
        if (this.config.defaultAccountId === id) {
            if (this.config.emailAccounts.length > 0) {
                this.config.emailAccounts[0].isDefault = true;
                this.config.defaultAccountId = this.config.emailAccounts[0].id;
            } else {
                this.config.defaultAccountId = null;
            }
        }

        this.saveConfig();
        this.logger.info(`删除邮箱账号: ${account.name} (${account.id})`);
        return true;
    }

    /**
     * 设为默认邮箱账号
     */
    setDefaultEmailAccount(id: string): boolean {
        const account = this.getEmailAccountById(id);
        if (!account) return false;

        // 取消所有账号的默认状态
        for (const acc of this.config.emailAccounts) {
            acc.isDefault = false;
        }

        // 设置新的默认账号
        account.isDefault = true;
        this.config.defaultAccountId = id;

        this.saveConfig();
        this.logger.info(`设置默认邮箱账号: ${account.name} (${account.id})`);
        return true;
    }

    // ==================== 统计 ====================

    /**
     * 增加处理计数
     */
    incrementProcessed(): void {
        const today = new Date().toDateString();
        if (this.stats.lastUpdateDay !== today) {
            this.stats.todayProcessed = 0;
            this.stats.lastUpdateDay = today;
        }
        this.stats.todayProcessed++;
        this.stats.processed++;
    }

    // ==================== 定时邮件管理 ====================

    /**
     * 启动定时邮件检查器
     * 每分钟检查一次是否有到期的定时邮件任务
     */
    private startScheduledEmailChecker(): void {
        // 避免重复启动
        if (this.timers.has('scheduledEmailChecker')) {
            return;
        }

        // 每分钟检查一次
        const CHECK_INTERVAL = 60 * 1000; // 60秒

        const checker = setInterval(async () => {
            try {
                const { checkAndExecuteScheduledEmails } = await import('../services/scheduled-email-service');
                await checkAndExecuteScheduledEmails();
            } catch (err) {
                this.logger.error('定时邮件检查器执行失败:', err);
            }
        }, CHECK_INTERVAL);

        this.timers.set('scheduledEmailChecker', checker);
        this.logger.debug('定时邮件检查器已启动（每分钟检查一次）');
    }

    /**
     * 停止定时邮件检查器
     */
    private stopScheduledEmailChecker(): void {
        const checker = this.timers.get('scheduledEmailChecker');
        if (checker) {
            clearInterval(checker);
            this.timers.delete('scheduledEmailChecker');
            this.logger.debug('定时邮件检查器已停止');
        }
    }

    // ==================== 工具方法 ====================

    /** 获取运行时长（毫秒） */
    getUptime(): number {
        return Date.now() - this.startTime;
    }

    /** 获取格式化的运行时长 */
    getUptimeFormatted(): string {
        const ms = this.getUptime();
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const d = Math.floor(h / 24);

        if (d > 0) return `${d}天${h % 24}小时`;
        if (h > 0) return `${h}小时${m % 60}分钟`;
        if (m > 0) return `${m}分钟${s % 60}秒`;
        return `${s}秒`;
    }
}

/** 导出全局单例 */
export const pluginState = new PluginState();
