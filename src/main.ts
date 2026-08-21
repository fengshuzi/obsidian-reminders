import { App, Plugin, Platform, PluginSettingTab, Setting } from "obsidian";
import { REMINDERS_AUTHORIZATION_INSTRUCTIONS } from "./reminders-result";
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
        if (!Platform.isMacOS) {
            console.warn("提醒事项插件仅支持 macOS 系统");
            return;
        }

        await this.loadSettings();

        this.storage = new ReminderStorage(this.settings.listName);

        this.registerView(VIEW_TYPE_REMINDERS, (leaf) => new RemindersView(leaf, this));

        this.addRibbonIcon("bell", "提醒事项", () => {
            void this.activateView();
        });

        this.addCommand({
            id: "open-reminders",
            name: "打开提醒事项",
            callback: () => {
                void this.activateView();
            },
        });

        this.addCommand({
            id: "add-reminder",
            name: "快速添加提醒",
            callback: () => {
                void this.activateView();
            },
        });

        this.addSettingTab(new RemindersSettingTab(this.app, this));
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<RemindersSettings>);
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
        if (this.storage) {
            this.storage.setListName(this.settings.listName);
        }
    }

    async activateView(): Promise<void> {
        const { workspace } = this.app;

        workspace.detachLeavesOfType(VIEW_TYPE_REMINDERS);

        const leaf = workspace.getLeaf('tab');
        
        await leaf.setViewState({
            type: VIEW_TYPE_REMINDERS,
            active: true,
        });

        workspace.setActiveLeaf(leaf, { focus: true });
    }
}

class RemindersSettingTab extends PluginSettingTab {
    plugin: RemindersPlugin;

    constructor(app: App, plugin: RemindersPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("系统授权")
            .setDesc(REMINDERS_AUTHORIZATION_INSTRUCTIONS);

        new Setting(containerEl)
            .setName("列表配置")
            .setHeading();

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

        const donateSection = containerEl.createDiv({ cls: 'plugin-donate-section' });
        new Setting(donateSection).setName('☕ 请作者喝杯咖啡').setHeading();
        donateSection.createEl('p', { text: '如果这个插件帮助了你，欢迎请作者喝杯咖啡 ☕', cls: 'plugin-donate-desc' });
        const imgWrap = donateSection.createDiv({ cls: 'plugin-donate-qr' });
        const donateImgSrc = "https://raw.githubusercontent.com/fengshuzi/images/main/wechat-donate.jpg";
        const donateImg = imgWrap.createEl('img', { attr: { src: donateImgSrc, alt: '微信打赏' }, cls: 'plugin-donate-img' });
        donateImg.addEventListener('click', () => {
            const overlay = activeDocument.body.createDiv({ cls: 'plugin-donate-lightbox' });
            overlay.createEl('img', { attr: { src: donateImgSrc, alt: '微信打赏' }, cls: 'plugin-donate-lightbox-img' });
            overlay.addEventListener('click', () => overlay.remove());
        });
        imgWrap.createEl('p', { text: '微信扫码', cls: 'plugin-donate-label' });
    }
}
