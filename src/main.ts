import { Plugin, Platform, PluginSettingTab, Setting } from "obsidian";
import { ReminderStorage } from "./storage";
import { RemindersView, VIEW_TYPE_REMINDERS } from "./views/RemindersView";

interface RemindersSettings {
    listName: string;
}

const DEFAULT_SETTINGS: RemindersSettings = {
    listName: "Inbox"
};

export default class RemindersPlugin extends Plugin {
    storage: ReminderStorage;
    settings: RemindersSettings;

    async onload(): Promise<void> {
        console.log("加载提醒事项插件 - macOS Reminders 集成");

        if (!Platform.isMacOS) {
            console.warn("提醒事项插件仅支持 macOS 系统");
            return;
        }

        await this.loadSettings();

        this.storage = new ReminderStorage(this.settings.listName);

        this.registerView(VIEW_TYPE_REMINDERS, (leaf) => new RemindersView(leaf, this));

        // 添加右侧边栏图标
        this.addRibbonIcon("bell", "提醒事项", () => {
            this.activateView();
        });

        // 添加命令
        this.addCommand({
            id: "open-reminders",
            name: "打开提醒事项",
            callback: () => this.activateView(),
        });

        this.addCommand({
            id: "add-reminder",
            name: "快速添加提醒",
            callback: () => {
                this.activateView();
            },
        });

        // 添加设置页面
        this.addSettingTab(new RemindersSettingTab(this.app, this));
    }

    async onunload(): Promise<void> {
        console.log("卸载提醒事项插件");
        this.app.workspace.detachLeavesOfType(VIEW_TYPE_REMINDERS);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        // 更新 storage 的列表名称
        if (this.storage) {
            this.storage.setListName(this.settings.listName);
        }
    }

    async activateView(): Promise<void> {
        const { workspace } = this.app;

        // 先关闭所有已存在的提醒事项视图
        workspace.detachLeavesOfType(VIEW_TYPE_REMINDERS);

        // 获取主编辑区域的 leaf（'tab' 模式会在主区域创建新标签页）
        const leaf = workspace.getLeaf('tab');
        
        await leaf.setViewState({
            type: VIEW_TYPE_REMINDERS,
            active: true,
        });

        // 激活这个 leaf
        workspace.setActiveLeaf(leaf, { focus: true });
    }
}

class RemindersSettingTab extends PluginSettingTab {
    plugin: RemindersPlugin;

    constructor(app: any, plugin: RemindersPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl("h2", { text: "提醒事项设置" });

        new Setting(containerEl)
            .setName("提醒列表名称")
            .setDesc("指定要显示的 macOS 提醒事项列表名称（默认：Inbox）")
            .addText((text) =>
                text
                    .setPlaceholder("Inbox")
                    .setValue(this.plugin.settings.listName)
                    .onChange(async (value) => {
                        this.plugin.settings.listName = value || "Inbox";
                        await this.plugin.saveSettings();
                    })
            );
    }
}
