/**
 * 定时邮件服务模块
 * 管理定时邮件任务的创建、执行和状态更新
 */

import { pluginState } from '../core/state';
import { sendEmail } from './email-service';
import { emailHistoryService } from './email-history-service';
import type { ScheduledEmail, CreateScheduledEmailParams, UpdateScheduledEmailParams, SendEmailParams } from '../types';

// 数据文件名称
const SCHEDULED_EMAILS_FILE = 'scheduled_emails.json';

/**
 * 获取所有定时邮件任务
 */
export function getScheduledEmails(): ScheduledEmail[] {
    return pluginState.loadDataFile<ScheduledEmail[]>(SCHEDULED_EMAILS_FILE, []);
}

/**
 * 保存定时邮件任务列表
 */
export function saveScheduledEmails(emails: ScheduledEmail[]): void {
    pluginState.saveDataFile(SCHEDULED_EMAILS_FILE, emails);
}

/**
 * 根据 ID 获取定时邮件任务
 */
export function getScheduledEmailById(id: string): ScheduledEmail | undefined {
    const emails = getScheduledEmails();
    return emails.find(e => e.id === id);
}

/**
 * 创建定时邮件任务
 */
export function createScheduledEmail(params: CreateScheduledEmailParams): ScheduledEmail {
    const emails = getScheduledEmails();
    
    const now = new Date().toISOString();
    const scheduledEmail: ScheduledEmail = {
        id: generateId(),
        name: params.name,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        attachments: params.attachments || [],
        scheduleType: params.scheduleType,
        scheduledAt: params.scheduledAt,
        intervalMinutes: params.intervalMinutes,
        weekday: params.weekday,
        dayOfMonth: params.dayOfMonth,
        status: 'pending',
        createdAt: now,
        sendCount: 0,
        maxSendCount: params.maxSendCount ?? null,
    };

    emails.push(scheduledEmail);
    saveScheduledEmails(emails);
    
    pluginState.logger.info(`创建定时邮件任务: ${scheduledEmail.name} (${scheduledEmail.id})`);
    
    return scheduledEmail;
}

/**
 * 更新定时邮件任务
 */
export function updateScheduledEmail(id: string, params: UpdateScheduledEmailParams): ScheduledEmail | null {
    const emails = getScheduledEmails();
    const index = emails.findIndex(e => e.id === id);
    
    if (index === -1) {
        return null;
    }

    const email = emails[index];
    
    // 更新字段
    if (params.name !== undefined) email.name = params.name;
    if (params.to !== undefined) email.to = params.to;
    if (params.subject !== undefined) email.subject = params.subject;
    if (params.text !== undefined) email.text = params.text;
    if (params.html !== undefined) email.html = params.html;
    if (params.attachments !== undefined) email.attachments = params.attachments;
    if (params.scheduleType !== undefined) email.scheduleType = params.scheduleType;
    if (params.scheduledAt !== undefined) email.scheduledAt = params.scheduledAt;
    if (params.intervalMinutes !== undefined) email.intervalMinutes = params.intervalMinutes;
    if (params.weekday !== undefined) email.weekday = params.weekday;
    if (params.dayOfMonth !== undefined) email.dayOfMonth = params.dayOfMonth;
    if (params.status !== undefined) email.status = params.status;
    if (params.maxSendCount !== undefined) email.maxSendCount = params.maxSendCount;

    emails[index] = email;
    saveScheduledEmails(emails);
    
    pluginState.logger.info(`更新定时邮件任务: ${email.name} (${email.id})`);
    
    return email;
}

/**
 * 删除定时邮件任务
 */
export function deleteScheduledEmail(id: string): boolean {
    const emails = getScheduledEmails();
    const index = emails.findIndex(e => e.id === id);
    
    if (index === -1) {
        return false;
    }

    const email = emails[index];
    emails.splice(index, 1);
    saveScheduledEmails(emails);
    
    pluginState.logger.info(`删除定时邮件任务: ${email.name} (${email.id})`);
    
    return true;
}

/**
 * 取消定时邮件任务
 */
export function cancelScheduledEmail(id: string): boolean {
    const email = updateScheduledEmail(id, { status: 'cancelled' });
    if (email) {
        pluginState.logger.info(`取消定时邮件任务: ${email.name} (${email.id})`);
        return true;
    }
    return false;
}

/**
 * 执行定时邮件发送
 */
export async function executeScheduledEmail(email: ScheduledEmail): Promise<{ success: boolean; message: string }> {
    try {
        const sendParams: SendEmailParams = {
            to: email.to,
            subject: email.subject,
            text: email.text,
            html: email.html,
            attachments: email.attachments,
        };

        const result = await sendEmail(sendParams);
        
        // 保存历史记录
        emailHistoryService.addRecord({
            sendType: 'scheduled',
            to: email.to,
            subject: email.subject,
            text: email.text,
            html: email.html,
            status: result.success ? 'success' : 'failed',
            errorMessage: result.success ? undefined : result.message,
            scheduledEmailId: email.id,
            attachmentCount: email.attachments?.length || 0,
            attachments: email.attachments?.map(att => ({ filename: att.filename, contentType: att.contentType })),
        });

        if (result.success) {
            // 更新发送状态
            const now = new Date().toISOString();
            email.lastSentAt = now;
            email.sendCount++;
            email.errorMessage = undefined;
            
            // 一次性任务标记为已发送
            if (email.scheduleType === 'once') {
                email.status = 'sent';
            }
            
            // 检查是否达到最大发送次数
            if (email.maxSendCount !== null && email.maxSendCount !== undefined && email.sendCount >= email.maxSendCount) {
                email.status = 'sent';
            }
            
            // 计算下次发送时间
            email.scheduledAt = calculateNextScheduledTime(email);
            
            // 保存更新
            const emails = getScheduledEmails();
            const index = emails.findIndex(e => e.id === email.id);
            if (index !== -1) {
                emails[index] = email;
                saveScheduledEmails(emails);
            }
            
            pluginState.logger.info(`定时邮件发送成功: ${email.name} (${email.id})`);
        } else {
            email.status = 'failed';
            email.errorMessage = result.message;
            
            const emails = getScheduledEmails();
            const index = emails.findIndex(e => e.id === email.id);
            if (index !== -1) {
                emails[index] = email;
                saveScheduledEmails(emails);
            }
            
            pluginState.logger.error(`定时邮件发送失败: ${email.name} (${email.id}) - ${result.message}`);
        }
        
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        email.status = 'failed';
        email.errorMessage = errorMessage;
        
        const emails = getScheduledEmails();
        const index = emails.findIndex(e => e.id === email.id);
        if (index !== -1) {
            emails[index] = email;
            saveScheduledEmails(emails);
        }
        
        pluginState.logger.error(`定时邮件发送异常: ${email.name} (${email.id}) - ${errorMessage}`);
        
        return { success: false, message: errorMessage };
    }
}

/**
 * 计算下次发送时间
 */
function calculateNextScheduledTime(email: ScheduledEmail): string {
    const now = new Date();
    const currentScheduled = new Date(email.scheduledAt);
    
    switch (email.scheduleType) {
        case 'daily':
            // 每天同一时间
            currentScheduled.setDate(currentScheduled.getDate() + 1);
            return currentScheduled.toISOString();
            
        case 'weekly':
            // 每周同一天
            currentScheduled.setDate(currentScheduled.getDate() + 7);
            return currentScheduled.toISOString();
            
        case 'monthly':
            // 每月同一天
            currentScheduled.setMonth(currentScheduled.getMonth() + 1);
            return currentScheduled.toISOString();
            
        case 'interval':
            // 按间隔时间
            if (email.intervalMinutes && email.intervalMinutes > 0) {
                const nextTime = new Date(now.getTime() + email.intervalMinutes * 60 * 1000);
                return nextTime.toISOString();
            }
            return currentScheduled.toISOString();
            
        case 'once':
        default:
            return currentScheduled.toISOString();
    }
}

/**
 * 检查定时邮件是否应该执行
 */
function shouldExecute(email: ScheduledEmail): boolean {
    if (email.status === 'cancelled' || email.status === 'sent') {
        return false;
    }
    
    const now = new Date();
    const scheduledTime = new Date(email.scheduledAt);
    
    // 到达或超过预定时间
    return now >= scheduledTime;
}

/**
 * 检查并执行到期的定时邮件任务
 * 应在定时器回调中调用
 */
export async function checkAndExecuteScheduledEmails(): Promise<void> {
    const emails = getScheduledEmails();
    const pendingEmails = emails.filter(e => e.status === 'pending' && shouldExecute(e));
    
    if (pendingEmails.length === 0) {
        return;
    }
    
    pluginState.logger.debug(`检查到 ${pendingEmails.length} 个待执行的定时邮件任务`);
    
    for (const email of pendingEmails) {
        // 避免并发执行同一个任务
        if (email.status !== 'pending') {
            continue;
        }
        
        // 立即执行，不等待
        executeScheduledEmail(email).catch(err => {
            pluginState.logger.error(`执行定时邮件任务失败: ${email.id}`, err);
        });
    }
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
    return `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 验证定时邮件参数
 */
export function validateScheduledEmailParams(params: CreateScheduledEmailParams): { valid: boolean; message: string } {
    if (!params.name || params.name.trim() === '') {
        return { valid: false, message: '任务名称不能为空' };
    }
    
    if (!params.to || params.to.trim() === '') {
        return { valid: false, message: '收件人不能为空' };
    }
    
    // 验证收件人邮箱格式
    const recipients = params.to.split(',').map(r => r.trim()).filter(r => r);
    if (recipients.length === 0) {
        return { valid: false, message: '收件人邮箱地址无效' };
    }
    
    const invalidRecipients = recipients.filter(r => !r.includes('@'));
    if (invalidRecipients.length > 0) {
        return { valid: false, message: `无效的收件人邮箱: ${invalidRecipients.join(', ')}` };
    }
    
    if (!params.subject || params.subject.trim() === '') {
        return { valid: false, message: '邮件主题不能为空' };
    }
    
    if (!params.scheduledAt) {
        return { valid: false, message: '发送时间不能为空' };
    }
    
    // 验证发送时间是否为有效日期
    const scheduledDate = new Date(params.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
        return { valid: false, message: '发送时间格式无效' };
    }
    
    // 一次性任务必须是在未来的时间
    if (params.scheduleType === 'once' && scheduledDate <= new Date()) {
        return { valid: false, message: '一次性任务的发送时间必须在将来' };
    }
    
    // 验证不同类型特有的参数
    switch (params.scheduleType) {
        case 'interval':
            if (!params.intervalMinutes || params.intervalMinutes <= 0) {
                return { valid: false, message: '间隔时间必须大于 0 分钟' };
            }
            break;
            
        case 'weekly':
            if (params.weekday === undefined || params.weekday < 0 || params.weekday > 6) {
                return { valid: false, message: '请选择有效的星期几（0-6，0=周日）' };
            }
            break;
            
        case 'monthly':
            if (params.dayOfMonth === undefined || params.dayOfMonth < 1 || params.dayOfMonth > 31) {
                return { valid: false, message: '请选择有效的日期（1-31）' };
            }
            break;
    }
    
    // 验证最大发送次数
    if (params.maxSendCount !== undefined && params.maxSendCount !== null && params.maxSendCount <= 0) {
        return { valid: false, message: '最大发送次数必须大于 0' };
    }
    
    return { valid: true, message: '参数有效' };
}
