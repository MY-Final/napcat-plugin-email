/**
 * 邮件历史记录服务
 * 管理邮件发送历史的持久化和查询
 */

import fs from 'fs';
import path from 'path';
import type { EmailHistory, EmailHistoryStats, EmailSendType, EmailSendStatus } from '../types';
import { pluginState } from '../core/state';

const HISTORY_FILE = 'email_history.json';
const MAX_HISTORY_SIZE = 1000; // 最多保留 1000 条记录

class EmailHistoryService {
    private history: EmailHistory[] = [];
    private dataDir: string = '';
    private initialized = false;

    /**
     * 初始化服务
     */
    init(dataDir: string): void {
        if (this.initialized) return;
        this.dataDir = dataDir;
        this.loadFromFile();
        this.initialized = true;
        pluginState.logger.info('邮件历史记录服务已初始化');
    }

    /**
     * 获取历史文件路径
     */
    private getHistoryFilePath(): string {
        return path.join(this.dataDir, HISTORY_FILE);
    }

    /**
     * 从文件加载历史记录
     */
    private loadFromFile(): void {
        try {
            const filePath = this.getHistoryFilePath();
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf-8');
                this.history = JSON.parse(data);
                pluginState.logger.debug(`已加载 ${this.history.length} 条邮件历史记录`);
            } else {
                this.history = [];
            }
        } catch (error) {
            pluginState.logger.error('加载邮件历史记录失败:', error);
            this.history = [];
        }
    }

    /**
     * 保存到文件
     */
    private saveToFile(): void {
        try {
            const filePath = this.getHistoryFilePath();
            fs.writeFileSync(filePath, JSON.stringify(this.history, null, 2), 'utf-8');
        } catch (error) {
            pluginState.logger.error('保存邮件历史记录失败:', error);
        }
    }

    /**
     * 添加邮件发送记录
     */
    addRecord(params: {
        sendType: EmailSendType;
        to: string;
        subject: string;
        text?: string;
        html?: string;
        status: EmailSendStatus;
        errorMessage?: string;
        scheduledEmailId?: string;
        attachmentCount?: number;
        attachments?: { filename: string; contentType?: string }[];
    }): EmailHistory {
        const record: EmailHistory = {
            id: this.generateId(),
            sendType: params.sendType,
            to: params.to,
            subject: params.subject,
            text: params.text,
            html: params.html,
            status: params.status,
            errorMessage: params.errorMessage,
            sentAt: new Date().toISOString(),
            scheduledEmailId: params.scheduledEmailId,
            attachmentCount: params.attachmentCount || 0,
            attachments: params.attachments,
        };

        this.history.unshift(record); // 新记录放前面

        // 限制历史记录数量
        if (this.history.length > MAX_HISTORY_SIZE) {
            this.history = this.history.slice(0, MAX_HISTORY_SIZE);
        }

        this.saveToFile();
        return record;
    }

    /**
     * 生成唯一 ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 获取历史记录列表（支持分页）
     */
    getHistory(options: {
        page?: number;
        pageSize?: number;
        sendType?: EmailSendType;
        status?: EmailSendStatus;
    } = {}): {
        list: EmailHistory[];
        total: number;
        page: number;
        pageSize: number;
    } {
        const { page = 1, pageSize = 20, sendType, status } = options;

        let filtered = this.history;

        // 按发送类型筛选
        if (sendType) {
            filtered = filtered.filter(h => h.sendType === sendType);
        }

        // 按状态筛选
        if (status) {
            filtered = filtered.filter(h => h.status === status);
        }

        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const list = filtered.slice(start, end);

        return { list, total, page, pageSize };
    }

    /**
     * 获取统计数据
     */
    getStats(): EmailHistoryStats {
        const stats: EmailHistoryStats = {
            total: this.history.length,
            success: 0,
            failed: 0,
            scheduled: 0,
            manual: 0,
            test: 0,
        };

        for (const record of this.history) {
            if (record.status === 'success') {
                stats.success++;
            } else {
                stats.failed++;
            }

            switch (record.sendType) {
                case 'scheduled':
                    stats.scheduled++;
                    break;
                case 'manual':
                    stats.manual++;
                    break;
                case 'test':
                    stats.test++;
                    break;
            }
        }

        return stats;
    }

    /**
     * 获取今日发送统计
     */
    getTodayStats(): EmailHistoryStats {
        const today = new Date().toDateString();
        const todayRecords = this.history.filter(h => {
            const recordDate = new Date(h.sentAt).toDateString();
            return recordDate === today;
        });

        const stats: EmailHistoryStats = {
            total: todayRecords.length,
            success: 0,
            failed: 0,
            scheduled: 0,
            manual: 0,
            test: 0,
        };

        for (const record of todayRecords) {
            if (record.status === 'success') {
                stats.success++;
            } else {
                stats.failed++;
            }

            switch (record.sendType) {
                case 'scheduled':
                    stats.scheduled++;
                    break;
                case 'manual':
                    stats.manual++;
                    break;
                case 'test':
                    stats.test++;
                    break;
            }
        }

        return stats;
    }

    /**
     * 清空历史记录
     */
    clearHistory(): void {
        this.history = [];
        this.saveToFile();
        pluginState.logger.info('邮件历史记录已清空');
    }

    /**
     * 获取单条记录
     */
    getRecordById(id: string): EmailHistory | undefined {
        return this.history.find(h => h.id === id);
    }

    /**
     * 删除单条记录
     */
    deleteRecord(id: string): boolean {
        const index = this.history.findIndex(h => h.id === id);
        if (index === -1) return false;

        this.history.splice(index, 1);
        this.saveToFile();
        return true;
    }
}

// 导出单例
export const emailHistoryService = new EmailHistoryService();
