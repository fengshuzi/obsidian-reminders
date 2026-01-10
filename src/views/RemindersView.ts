import { ItemView, WorkspaceLeaf, Menu } from "obsidian";
import type RemindersPlugin from "../main";
import { Reminder } from "../types";
import { DateTimePickerModal } from "../components/DateTimePicker";

export const VIEW_TYPE_REMINDERS = "reminders-view";

export class RemindersView extends ItemView {
    plugin: RemindersPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: RemindersPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_REMINDERS;
    }

    getDisplayText(): string {
        return "提醒事项";
    }

    getIcon(): string {
        return "bell";
    }

    async onOpen(): Promise<void> {
        this.render();
    }

    async onClose(): Promise<void> {
        // 清理
    }

    render(): void {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("reminders-view");

        this.renderInputArea(container);
        this.renderRemindersList(container);
    }

    private renderInputArea(container: HTMLElement): void {
        const inputArea = container.createDiv("reminders-input-area");

        const inputWrapper = inputArea.createDiv("reminders-input-wrapper");
        
        // 添加状态提示
        const statusHint = inputWrapper.createDiv("reminders-input-hint");
        statusHint.style.display = "none";
        statusHint.style.fontSize = "12px";
        statusHint.style.color = "var(--text-muted)";
        statusHint.style.marginBottom = "8px";
        
        const textarea = inputWrapper.createEl("textarea", {
            cls: "reminders-input",
            attr: {
                placeholder: "你现在在想什么？",
                rows: "3"
            }
        });

        const inputActions = inputWrapper.createDiv("reminders-input-actions");

        // 底部工具栏 - 时间按钮使用日历图标
        const toolbar = inputActions.createDiv("reminders-input-toolbar");
        
        // 存储选中的时间
        let selectedTime: Date | null = null;
        
        // 时间显示区域
        const timeDisplay = inputWrapper.createDiv("reminders-time-display");
        timeDisplay.style.display = "none";
        timeDisplay.style.marginTop = "12px";
        timeDisplay.style.padding = "8px 12px";
        timeDisplay.style.background = "var(--background-secondary)";
        timeDisplay.style.borderRadius = "6px";
        timeDisplay.style.fontSize = "13px";

        const updateTimeDisplay = () => {
            if (selectedTime) {
                timeDisplay.style.display = "block";
                timeDisplay.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>📅 ${this.formatDateTime(selectedTime.toISOString())}</span>
                        <button class="reminders-time-clear" style="padding: 2px 8px; font-size: 12px;">清除</button>
                    </div>
                `;
                const clearBtn = timeDisplay.querySelector('.reminders-time-clear') as HTMLElement;
                clearBtn?.addEventListener('click', () => {
                    selectedTime = null;
                    timeDisplay.style.display = "none";
                    timeBtn.removeClass('active');
                });
            } else {
                timeDisplay.style.display = "none";
            }
        };
        
        const timeBtn = toolbar.createEl("button", { cls: "reminders-toolbar-btn" });
        timeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>`;
        timeBtn.title = "选择日期时间";
        timeBtn.onclick = () => {
            this.showDateTimePicker(selectedTime || new Date(), (date) => {
                selectedTime = date;
                updateTimeDisplay();
                timeBtn.addClass('active');
            });
        };

        const actionButtons = inputActions.createDiv("reminders-action-buttons");
        actionButtons.style.display = "flex";
        actionButtons.style.gap = "8px";

        const cancelBtn = actionButtons.createEl("button", {
            cls: "reminders-cancel-btn",
            text: "取消编辑"
        });
        cancelBtn.style.display = "none";

        const submitBtn = actionButtons.createEl("button", {
            cls: "reminders-submit-btn",
            text: "NOTE"
        });

        // 存储当前编辑的提醒 ID
        let editingReminderId: string | null = null;

        cancelBtn.onclick = () => {
            textarea.value = "";
            selectedTime = null;
            timeDisplay.style.display = "none";
            statusHint.style.display = "none";
            cancelBtn.style.display = "none";
            submitBtn.textContent = "NOTE";
            textarea.placeholder = "你现在在想什么？";
            editingReminderId = null;
            timeBtn.removeClass('active');
        };

        submitBtn.onclick = async () => {
            const content = textarea.value.trim();
            if (!content) return;

            const dueDate = selectedTime ? selectedTime.toISOString() : undefined;

            if (editingReminderId) {
                // 更新模式
                await this.plugin.storage.updateReminder(editingReminderId, content, dueDate);
            } else {
                // 新建模式
                await this.plugin.storage.addReminder(content, dueDate);
            }

            textarea.value = "";
            selectedTime = null;
            timeDisplay.style.display = "none";
            statusHint.style.display = "none";
            cancelBtn.style.display = "none";
            submitBtn.textContent = "NOTE";
            textarea.placeholder = "你现在在想什么？";
            editingReminderId = null;
            timeBtn.removeClass('active');
            
            await this.loadAndRender();
        };

        // 回车提交
        textarea.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitBtn.click();
            } else if (e.key === "Escape" && editingReminderId) {
                e.preventDefault();
                cancelBtn.click();
            }
        };

        // 暴露编辑方法供外部调用
        (this as any).startEditReminder = (reminder: Reminder) => {
            editingReminderId = reminder.id;
            textarea.value = reminder.title;
            if (reminder.due) {
                selectedTime = new Date(reminder.due);
                updateTimeDisplay();
                timeBtn.addClass('active');
            }
            statusHint.textContent = "Modifying...";
            statusHint.style.display = "block";
            cancelBtn.style.display = "block";
            submitBtn.textContent = "保存";
            textarea.placeholder = "编辑提醒内容...";
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            
            // 滚动到顶部
            this.containerEl.scrollTop = 0;
        };
    }

    private showDateTimePicker(initialDate: Date, onSelect: (date: Date) => void): void {
        const modal = new DateTimePickerModal({
            initialDate,
            onSelect: (date) => {
                onSelect(date);
            },
            onClose: () => {
                // cleanup
            },
        });
        
        modal.open();
    }

    private renderHeader(container: HTMLElement): void {
        const header = container.createDiv("reminders-header");

        const titleSection = header.createDiv("reminders-title-section");
        titleSection.createSpan({ text: "✨ 提醒事项", cls: "reminders-title" });
        titleSection.createSpan({ 
            text: "快速记录你的想法", 
            cls: "reminders-subtitle" 
        });

        const actions = header.createDiv("reminders-actions");

        const refreshBtn = actions.createEl("button", { cls: "reminders-btn" });
        refreshBtn.innerHTML = "🔄";
        refreshBtn.title = "刷新";
        refreshBtn.onclick = () => this.loadAndRender();
    }

    private async loadAndRender(): Promise<void> {
        const reminders = await this.plugin.storage.getAllReminders();
        this.renderRemindersContent(reminders);
    }

    private renderRemindersList(container: HTMLElement): void {
        const listContainer = container.createDiv("reminders-list-container");
        listContainer.createDiv({ text: "加载中...", cls: "reminders-loading" });

        // 异步加载提醒
        this.plugin.storage.getAllReminders().then((reminders) => {
            listContainer.empty();
            this.renderRemindersContent(reminders, listContainer);
        });
    }

    private renderRemindersContent(reminders: Reminder[], container?: HTMLElement): void {
        const listContainer = container || this.containerEl.querySelector(".reminders-list-container") as HTMLElement;
        if (!listContainer) return;

        listContainer.empty();

        if (reminders.length === 0) {
            const emptyState = listContainer.createDiv({ cls: "reminders-empty-state" });
            emptyState.createDiv({ text: "💭", cls: "reminders-empty-icon" });
            emptyState.createDiv({ text: "还没有提醒事项", cls: "reminders-empty-title" });
            emptyState.createDiv({ 
                text: "在上方输入框开始记录", 
                cls: "reminders-empty-desc" 
            });
            return;
        }

        // 按时间排序，最新的在上面
        const sorted = this.plugin.storage.sortReminders(reminders, "due");
        
        sorted.forEach((reminder) => {
            this.renderReminderItem(listContainer, reminder);
        });
    }

    private renderReminderItem(container: HTMLElement, reminder: Reminder): void {
        const item = container.createDiv("reminder-item");
        item.dataset.reminderId = reminder.id;

        // 卡片
        const card = item.createDiv("reminder-card");

        // 卡片头部 - 时间（左）+ 操作按钮（右）
        const cardHeader = card.createDiv("reminder-card-header");
        
        // 时间显示（在卡片内左上角）
        const timeEl = cardHeader.createDiv("reminder-card-time");
        timeEl.textContent = this.formatDateTime(reminder.due || reminder.created);
        
        const cardActions = cardHeader.createDiv("reminder-card-actions");
        
        const moreBtn = cardActions.createEl("button", { cls: "reminder-more-btn" });
        moreBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
        </svg>`;
        moreBtn.title = "更多操作";
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.showContextMenu(e, reminder);
        };

        // 卡片内容 - 双击进入编辑模式
        const cardBody = card.createDiv("reminder-card-body");
        
        const titleEl = cardBody.createDiv({ text: reminder.title, cls: "reminder-card-title" });
        
        // 双击进入编辑模式 - 跳转到顶部输入框
        cardBody.ondblclick = () => {
            if ((this as any).startEditReminder) {
                (this as any).startEditReminder(reminder);
            }
        };

        card.oncontextmenu = (e) => {
            e.preventDefault();
            this.showContextMenu(e, reminder);
        };
    }

    private enterEditMode(item: HTMLElement, reminder: Reminder, titleEl: HTMLElement): void {
        const cardBody = item.querySelector('.reminder-card-body') as HTMLElement;
        if (!cardBody) return;

        // 将标题元素替换为 textarea
        const textarea = document.createElement('textarea');
        textarea.className = 'reminder-edit-input';
        textarea.value = reminder.title;
        textarea.rows = 3;
        
        // 替换标题元素
        titleEl.replaceWith(textarea);
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // 在卡片底部添加操作按钮
        const editActions = cardBody.createDiv('reminder-edit-actions');
        
        const cancelBtn = editActions.createEl('button', {
            cls: 'reminder-edit-btn reminder-edit-cancel',
            text: '取消'
        });
        
        const saveBtn = editActions.createEl('button', {
            cls: 'reminder-edit-btn reminder-edit-save',
            text: '保存'
        });

        const exitEditMode = () => {
            // 恢复标题显示
            const newTitleEl = cardBody.createDiv({ text: reminder.title, cls: 'reminder-card-title' });
            textarea.replaceWith(newTitleEl);
            editActions.remove();
            
            // 重新绑定双击事件
            cardBody.ondblclick = () => {
                this.enterEditMode(item, reminder, newTitleEl);
            };
        };

        cancelBtn.onclick = exitEditMode;

        saveBtn.onclick = async () => {
            const newTitle = textarea.value.trim();
            if (!newTitle) return;

            await this.plugin.storage.updateReminder(reminder.id, newTitle, reminder.due);
            await this.loadAndRender();
        };

        // ESC 取消，Ctrl/Cmd+Enter 保存
        textarea.onkeydown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                exitEditMode();
            } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                saveBtn.click();
            }
        };

        // 点击外部取消编辑
        const clickOutside = (e: MouseEvent) => {
            const card = item.querySelector('.reminder-card') as HTMLElement;
            if (card && !card.contains(e.target as Node)) {
                exitEditMode();
                document.removeEventListener('click', clickOutside);
            }
        };
        setTimeout(() => document.addEventListener('click', clickOutside), 100);
    }

    private formatDateTime(dateStr?: string): string {
        if (!dateStr) return "";
        
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = this.pad(date.getMonth() + 1);
        const day = this.pad(date.getDate());
        const hour = this.pad(date.getHours());
        const minute = this.pad(date.getMinutes());
        
        // 如果是 00:00，只显示日期
        if (hour === '00' && minute === '00') {
            return `${year}-${month}-${day}`;
        }
        
        return `${year}-${month}-${day} ${hour}:${minute}`;
    }

    private showContextMenu(e: MouseEvent, reminder: Reminder): void {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("编辑")
                .setIcon("pencil")
                .onClick(() => {
                    if ((this as any).startEditReminder) {
                        (this as any).startEditReminder(reminder);
                    }
                });
        });

        menu.addItem((item) => {
            item.setTitle("标记完成")
                .setIcon("check")
                .onClick(async () => {
                    await this.plugin.storage.toggleComplete(reminder.id);
                    await this.loadAndRender();
                });
        });

        menu.addItem((item) => {
            item.setTitle("删除")
                .setIcon("trash")
                .onClick(async () => {
                    if (confirm(`确定删除这条提醒事项吗？`)) {
                        await this.plugin.storage.deleteReminder(reminder.id);
                        await this.loadAndRender();
                    }
                });
        });

        menu.showAtMouseEvent(e);
    }

    private formatDue(dueStr: string): string {
        const date = new Date(dueStr);
        const hour = date.getHours();
        const minute = date.getMinutes();

        if (hour === 0 && minute === 0) {
            return this.formatDate(date);
        }

        return `${this.formatDate(date)} ${this.pad(hour)}:${this.pad(minute)}`;
    }

    private formatDate(date: Date): string {
        const year = date.getFullYear();
        const month = this.pad(date.getMonth() + 1);
        const day = this.pad(date.getDate());
        return `${year}-${month}-${day}`;
    }

    private pad(n: number): string {
        return n < 10 ? `0${n}` : `${n}`;
    }
}
