import { App, Modal, Setting, Notice } from "obsidian";
import type RemindersPlugin from "../main";
import { Reminder } from "../types";

export class ReminderModal extends Modal {
    plugin: RemindersPlugin;
    reminder?: Reminder;
    onSubmit: () => void;

    private titleInput = "";
    private listInput = "Inbox";
    private dueInput = "";
    private lists: string[] = [];

    constructor(
        app: App,
        plugin: RemindersPlugin,
        reminder?: Reminder,
        onSubmit?: () => void
    ) {
        super(app);
        this.plugin = plugin;
        this.reminder = reminder;
        this.onSubmit = onSubmit || (() => {});

        if (reminder) {
            this.titleInput = reminder.title;
            this.listInput = reminder.list;
            this.dueInput = reminder.due ? this.toDatetimeLocal(reminder.due) : "";
        }

        // 加载列表
        this.plugin.storage.getLists().then((lists) => {
            this.lists = lists;
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", {
            text: this.reminder ? "编辑提醒" : "✨ 新建提醒",
        });

        new Setting(contentEl).setName("内容").addText((text) =>
            text
                .setPlaceholder("记录你的想法...")
                .setValue(this.titleInput)
                .onChange((value) => (this.titleInput = value))
        );

        // 异步加载列表后更新下拉框
        const listSetting = new Setting(contentEl).setName("列表");
        this.plugin.storage.getLists().then((lists) => {
            this.lists = lists;
            listSetting.addDropdown((dropdown) => {
                lists.forEach((list) => {
                    dropdown.addOption(list, list);
                });
                dropdown.setValue(this.listInput);
                dropdown.onChange((value) => (this.listInput = value));
            });
        });

        new Setting(contentEl)
            .setName("截止时间")
            .setDesc("留空表示无截止时间")
            .addText((text) => {
                text.setPlaceholder("YYYY-MM-DD HH:mm")
                    .setValue(this.dueInput)
                    .onChange((value) => (this.dueInput = value));
                text.inputEl.type = "datetime-local";
                return text;
            });

        new Setting(contentEl)
            .addButton((btn) =>
                btn.setButtonText("取消").onClick(() => this.close())
            )
            .addButton((btn) =>
                btn
                    .setButtonText(this.reminder ? "保存" : "添加")
                    .setCta()
                    .onClick(() => this.handleSubmit())
            );
    }

    private async handleSubmit(): Promise<void> {
        if (!this.titleInput.trim()) {
            new Notice("请输入提醒标题");
            return;
        }

        const title = this.titleInput.trim();
        const due = this.dueInput ? new Date(this.dueInput).toISOString() : undefined;

        let success = false;

        if (this.reminder) {
            // 更新模式
            success = await this.plugin.storage.updateReminder(this.reminder.id, title, due);
        } else {
            // 创建模式
            success = await this.plugin.storage.createReminder(title, this.listInput, due);
        }

        if (success) {
            this.onSubmit();
            this.close();
        }
    }

    private toDatetimeLocal(isoString: string): string {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
