import { ItemView, WorkspaceLeaf, Menu, Modal, setIcon } from "obsidian";
import type RemindersPlugin from "../main";
import { Reminder } from "../types";
import type { ReminderPermission } from "../storage";
import { DateTimePickerModal } from "../components/DateTimePicker";

export const VIEW_TYPE_REMINDERS = "reminders-view";

interface ReminderGroup {
    label: string;
    reminders: Reminder[];
}

export class RemindersView extends ItemView {
    plugin: RemindersPlugin;
    private editHandler: ((reminder: Reminder) => void) | null = null;
    private listContainer: HTMLElement | null = null;
    private inputArea: HTMLElement | null = null;
    private textarea: HTMLTextAreaElement | null = null;
    private submitBtn: HTMLButtonElement | null = null;
    private cancelBtn: HTMLButtonElement | null = null;
    private timeBtn: HTMLButtonElement | null = null;
    private timeDisplay: HTMLElement | null = null;
    private statusHint: HTMLElement | null = null;

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
        // cleanup placeholder
    }

    render(): void {
        const container = this.contentEl;
        container.empty();
        container.addClass("reminders-view");

        this.renderInputArea(container);
        this.renderRemindersList(container);
    }

    private renderInputArea(container: HTMLElement): void {
        const inputArea = container.createDiv("reminders-input-area is-hidden");
        this.inputArea = inputArea;
        const inputWrapper = inputArea.createDiv("reminders-input-wrapper");

        this.statusHint = inputWrapper.createDiv("reminders-input-hint is-hidden");

        this.textarea = inputWrapper.createEl("textarea", {
            cls: "reminders-input",
            attr: {
                placeholder: "你现在在想什么？",
                rows: "3",
            },
        });

        this.timeDisplay = inputWrapper.createDiv("reminders-time-display is-hidden");

        const inputActions = inputWrapper.createDiv("reminders-input-actions");
        const toolbar = inputActions.createDiv("reminders-input-toolbar");

        let selectedTime: Date | null = null;

        const updateTimeDisplay = () => {
            if (!this.timeDisplay) return;
            if (selectedTime) {
                this.timeDisplay.removeClass("is-hidden");
                this.timeDisplay.empty();
                const inner = this.timeDisplay.createDiv({ cls: "reminders-time-display-inner" });
                const chip = inner.createDiv({ cls: "reminders-time-chip" });
                setIcon(chip.createSpan(), "calendar-clock");
                chip.createSpan({ text: this.formatDateTime(selectedTime.toISOString()), cls: "reminders-time-text" });
                const clearBtn = inner.createEl("button", { text: "清除", cls: "reminders-time-clear" });
                clearBtn.addEventListener("click", () => {
                    selectedTime = null;
                    this.timeDisplay?.addClass("is-hidden");
                    this.timeBtn?.removeClass("active");
                    this.textarea?.focus();
                });
            } else {
                this.timeDisplay.addClass("is-hidden");
            }
        };

        this.timeBtn = toolbar.createEl("button", { cls: "reminders-toolbar-btn" });
        setIcon(this.timeBtn, "calendar");
        this.timeBtn.title = "选择日期时间";
        this.timeBtn.onclick = () => {
            this.showDateTimePicker(selectedTime || new Date(), (date) => {
                selectedTime = date;
                updateTimeDisplay();
                this.timeBtn?.addClass("active");
                this.textarea?.focus();
            });
        };

        const actionButtons = inputActions.createDiv("reminders-action-buttons");

        this.cancelBtn = actionButtons.createEl("button", {
            cls: "reminders-cancel-btn is-hidden",
            text: "取消",
        });

        this.submitBtn = actionButtons.createEl("button", {
            cls: "reminders-submit-btn",
            text: "添加提醒",
        });

        let editingReminderId: string | null = null;

        const showComposer = (mode: "create" | "edit") => {
            this.inputArea?.removeClass("is-hidden");
            if (this.statusHint) {
                this.statusHint.textContent = mode === "edit" ? "正在编辑提醒" : "添加提醒";
                this.statusHint.removeClass("is-hidden");
            }
            if (this.submitBtn) this.submitBtn.textContent = mode === "edit" ? "保存" : "添加提醒";
            if (this.textarea) {
                this.textarea.placeholder = mode === "edit" ? "编辑提醒内容..." : "添加提醒事项...";
                this.textarea.focus();
            }
            this.cancelBtn?.removeClass("is-hidden");
            this.autoResizeTextarea();
            this.containerEl.scrollTop = 0;
        };

        this.cancelBtn.onclick = () => {
            this.resetComposer();
            selectedTime = null;
            editingReminderId = null;
        };

        this.submitBtn.onclick = async () => {
            const content = this.textarea?.value.trim();
            if (!content) return;

            const dueDate = selectedTime ? selectedTime.toISOString() : undefined;

            if (editingReminderId) {
                await this.plugin.storage.updateReminder(editingReminderId, content, dueDate);
            } else {
                await this.plugin.storage.addReminder(content, dueDate);
            }

            this.resetComposer();
            selectedTime = null;
            editingReminderId = null;
            await this.loadAndRender();
        };

        this.textarea.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void this.submitBtn?.click();
            } else if (e.key === "Escape" && editingReminderId) {
                e.preventDefault();
                this.cancelBtn?.click();
            } else if (e.key === "Escape") {
                e.preventDefault();
                this.cancelBtn?.click();
            }
        };

        this.textarea.oninput = () => {
            this.autoResizeTextarea();
        };

        this.editHandler = (reminder: Reminder) => {
            editingReminderId = reminder.id;
            if (this.textarea) this.textarea.value = reminder.title;
            if (reminder.due) {
                selectedTime = new Date(reminder.due);
                updateTimeDisplay();
                this.timeBtn?.addClass("active");
            } else {
                selectedTime = null;
                updateTimeDisplay();
                this.timeBtn?.removeClass("active");
            }
            if (this.textarea) {
                this.textarea.setSelectionRange(this.textarea.value.length, this.textarea.value.length);
            }
            showComposer("edit");
        };

        this.showCreateComposer = () => {
            editingReminderId = null;
            selectedTime = null;
            this.resetComposer();
            showComposer("create");
        };

        this.autoResizeTextarea();
    }

    private autoResizeTextarea(): void {
        if (!this.textarea) return;
        this.textarea.setCssProps({ height: "auto" });
        const maxHeight = 160;
        this.textarea.setCssProps({ height: `${Math.min(this.textarea.scrollHeight, maxHeight)}px` });
    }

    private resetComposer(): void {
        if (this.textarea) {
            this.textarea.value = "";
            this.textarea.setCssProps({ height: "auto" });
            this.textarea.placeholder = "添加提醒事项...";
        }
        this.timeDisplay?.empty();
        this.timeDisplay?.addClass("is-hidden");
        this.statusHint?.addClass("is-hidden");
        this.cancelBtn?.addClass("is-hidden");
        this.timeBtn?.removeClass("active");
        this.inputArea?.addClass("is-hidden");
        if (this.submitBtn) this.submitBtn.textContent = "添加提醒";
    }

    private showCreateComposer(): void {
        // assigned dynamically in renderInputArea
    }

    private showDateTimePicker(initialDate: Date, onSelect: (date: Date) => void): void {
        const modal = new DateTimePickerModal(this.app, {
            initialDate,
            onSelect,
            onClose: () => {
                // no-op
            },
        });
        modal.open();
    }

    private async loadAndRender(): Promise<void> {
        const { reminders, permission } = await this.plugin.storage.getAllReminders();
        this.renderRemindersContent(reminders, permission);
    }

    private renderRemindersList(container: HTMLElement): void {
        this.listContainer = container.createDiv("reminders-list-container");
        this.listContainer.createDiv({ text: "加载中...", cls: "reminders-loading" });

        void this.plugin.storage.getAllReminders().then(({ reminders, permission }) => {
            if (!this.listContainer) return;
            this.listContainer.empty();
            this.renderRemindersContent(reminders, permission, this.listContainer);
        });
    }

    private renderRemindersContent(
        reminders: Reminder[],
        permission: ReminderPermission,
        container?: HTMLElement,
    ): void {
        const listContainer = container || this.listContainer;
        if (!listContainer) return;

        listContainer.empty();

        const header = listContainer.createDiv("reminders-list-header");
        header.createDiv({ cls: "reminders-list-title", text: "提醒事项" });
        const headerActions = header.createDiv("reminders-list-actions");
        const refreshBtn = headerActions.createEl("button", { cls: "reminders-refresh-btn", text: "刷新" });
        setIcon(refreshBtn.createSpan(), "refresh-cw");
        refreshBtn.onclick = () => {
            void this.loadAndRender();
        };
        if (permission === "authorized") {
            const addBtn = headerActions.createEl("button", { cls: "reminders-add-btn", text: "添加" });
            setIcon(addBtn.createSpan(), "plus");
            addBtn.onclick = () => {
                this.showCreateComposer();
            };
        }

        if (permission !== "authorized") {
            this.renderPermissionState(listContainer, permission);
            return;
        }

        if (reminders.length === 0) {
            const emptyState = listContainer.createDiv({ cls: "reminders-empty-state" });
            emptyState.createDiv({ text: "💭", cls: "reminders-empty-icon" });
            emptyState.createDiv({ text: "还没有提醒事项", cls: "reminders-empty-title" });
            emptyState.createDiv({ text: "点击添加按钮创建，或直接在 Apple 提醒事项中添加。", cls: "reminders-empty-desc" });
            return;
        }

        const sorted = this.plugin.storage.sortReminders(reminders, "due");
        const grouped = this.groupReminders(sorted);

        for (const group of grouped) {
            this.renderGroup(listContainer, group);
        }
    }

    private renderPermissionState(container: HTMLElement, permission: ReminderPermission): void {
        const state = container.createDiv({ cls: "reminders-empty-state" });
        const icon = state.createDiv({ cls: "reminders-empty-icon" });
        setIcon(icon, permission === "denied" ? "shield-alert" : "circle-alert");
        state.createDiv({
            text: permission === "denied" ? "未授权访问提醒事项" : "无法读取提醒事项",
            cls: "reminders-empty-title",
        });
        state.createDiv({
            text: permission === "denied"
                ? "请在“系统设置 → 隐私与安全性 → 提醒事项”中允许 Obsidian 访问，然后重新检查。"
                : "请检查系统权限后重新检查。",
            cls: "reminders-empty-desc",
        });
        const retryBtn = state.createEl("button", { cls: "reminders-add-btn reminders-permission-retry", text: "重新检查" });
        setIcon(retryBtn.createSpan(), "refresh-cw");
        retryBtn.onclick = () => {
            void this.loadAndRender();
        };
    }

    private groupReminders(reminders: Reminder[]): ReminderGroup[] {
        const groups = new Map<string, Reminder[]>();
        for (const reminder of reminders) {
            const key = reminder.due ? this.getDayKey(reminder.due) : "no-date";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(reminder);
        }

        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
            if (a === "no-date") return 1;
            if (b === "no-date") return -1;
            return a.localeCompare(b);
        });

        return sortedKeys.map((key) => ({
            label: this.getDayLabel(key),
            reminders: groups.get(key)!,
        }));
    }

    private getDayKey(isoStr: string): string {
        const date = new Date(isoStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    private getDayLabel(key: string): string {
        if (key === "no-date") return "未设置日期";
        const today = this.getDayKey(new Date().toISOString());
        const tomorrow = this.getDayKey(new Date(Date.now() + 86400000).toISOString());
        const dayAfter = this.getDayKey(new Date(Date.now() + 172800000).toISOString());
        if (key === today) return "今天";
        if (key === tomorrow) return "明天";
        if (key === dayAfter) return "后天";
        return `${key.slice(5)}`;
    }

    private renderGroup(container: HTMLElement, group: ReminderGroup): void {
        const groupEl = container.createDiv("reminders-day-group");
        const header = groupEl.createDiv("reminders-day-header");
        header.createSpan({ text: group.label, cls: "reminders-day-label" });
        header.createSpan({ text: `${group.reminders.length}`, cls: "reminders-day-count" });

        const list = groupEl.createDiv("reminders-cards-list");
        for (const reminder of group.reminders) {
            this.renderReminderItem(list, reminder);
        }
    }

    private renderReminderItem(container: HTMLElement, reminder: Reminder): void {
        const item = container.createDiv("reminder-item");
        item.dataset.reminderId = reminder.id;

        const card = item.createDiv("reminder-card");

        const cardHeader = card.createDiv("reminder-card-header");
        const timeEl = cardHeader.createDiv("reminder-card-time");
        if (reminder.due) {
            timeEl.textContent = this.formatTime(reminder.due);
        } else {
            timeEl.addClass("no-time");
            timeEl.textContent = "无时间";
        }

        const cardActions = cardHeader.createDiv("reminder-card-actions");

        const completeBtn = cardActions.createEl("button", { cls: "reminder-action-btn" });
        setIcon(completeBtn, "check");
        completeBtn.title = "标记完成";
        completeBtn.onclick = (e) => {
            e.stopPropagation();
            void this.plugin.storage.toggleComplete(reminder.id);
            void this.loadAndRender();
        };

        const moreBtn = cardActions.createEl("button", { cls: "reminder-action-btn" });
        setIcon(moreBtn, "more-horizontal");
        moreBtn.title = "更多操作";
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.showContextMenu(e, reminder);
        };

        const cardBody = card.createDiv("reminder-card-body");
        cardBody.createDiv({ text: reminder.title, cls: "reminder-card-title" });

        cardBody.onclick = () => {
            this.editHandler?.(reminder);
        };

        card.oncontextmenu = (e) => {
            e.preventDefault();
            this.showContextMenu(e, reminder);
        };
    }

    private formatDateTime(dateStr?: string): string {
        if (!dateStr) return "";

        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = this.pad(date.getMonth() + 1);
        const day = this.pad(date.getDate());
        const hour = this.pad(date.getHours());
        const minute = this.pad(date.getMinutes());

        if (hour === "00" && minute === "00") {
            return `${year}-${month}-${day}`;
        }

        return `${year}-${month}-${day} ${hour}:${minute}`;
    }

    private formatTime(isoStr: string): string {
        const date = new Date(isoStr);
        const hour = this.pad(date.getHours());
        const minute = this.pad(date.getMinutes());
        if (hour === "00" && minute === "00") {
            return "全天";
        }
        return `${hour}:${minute}`;
    }

    private showContextMenu(e: MouseEvent, reminder: Reminder): void {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("编辑").setIcon("pencil").onClick(() => {
                this.editHandler?.(reminder);
            });
        });

        menu.addItem((item) => {
            item.setTitle("标记完成").setIcon("check").onClick(() => {
                void this.plugin.storage.toggleComplete(reminder.id);
                void this.loadAndRender();
            });
        });

        menu.addItem((item) => {
            item.setTitle("删除").setIcon("trash").onClick(() => {
                void this.confirmAndDelete(reminder);
            });
        });

        menu.showAtMouseEvent(e);
    }

    private async confirmAndDelete(reminder: Reminder): Promise<void> {
        const confirmed = await new Promise<boolean>((resolve) => {
            const modal = new Modal(this.app);
            modal.titleEl.setText("确认删除");
            modal.contentEl.createEl("p", { text: "确定删除这条提醒事项吗？" });
            const btnGroup = modal.contentEl.createDiv({ cls: "reminders-modal-actions" });
            btnGroup.createEl("button", { text: "取消", cls: "reminders-modal-btn" }).onclick = () => {
                modal.close();
                resolve(false);
            };
            const confirmBtn = btnGroup.createEl("button", { text: "删除", cls: "reminders-modal-btn mod-warning" });
            confirmBtn.onclick = () => {
                modal.close();
                resolve(true);
            };
            modal.open();
        });

        if (confirmed) {
            await this.plugin.storage.deleteReminder(reminder.id);
            await this.loadAndRender();
        }
    }

    private pad(n: number): string {
        return n < 10 ? `0${n}` : `${n}`;
    }
}
