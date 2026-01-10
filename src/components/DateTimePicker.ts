import { Modal } from "obsidian";

export interface DateTimePickerOptions {
    initialDate?: Date;
    onSelect: (date: Date) => void;
    onClose?: () => void;
}

export class DateTimePickerModal extends Modal {
    private options: DateTimePickerOptions;
    private dateInput: HTMLInputElement;

    constructor(options: DateTimePickerOptions) {
        super(app);
        this.options = options;
    }

    onOpen(): void {
        this.titleEl.setText("选择日期和时间");
        
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("datetime-picker-modal");
        
        const initialDate = this.options.initialDate || new Date();
        
        // 日期时间输入
        const dateGroup = contentEl.createDiv("datetime-group");
        dateGroup.createEl("label", { text: "提醒时间:" });
        this.dateInput = dateGroup.createEl("input", {
            type: "datetime-local",
            cls: "datetime-input"
        });
        this.dateInput.value = this.formatDateTimeLocal(initialDate);
        
        // 按钮
        const buttonGroup = contentEl.createDiv("datetime-buttons");
        
        const cancelBtn = buttonGroup.createEl("button", {
            text: "取消",
            cls: "datetime-btn datetime-btn-cancel"
        });
        cancelBtn.onclick = () => this.close();
        
        const confirmBtn = buttonGroup.createEl("button", {
            text: "确定",
            cls: "datetime-btn datetime-btn-confirm"
        });
        confirmBtn.onclick = () => {
            const date = new Date(this.dateInput.value);
            this.options.onSelect(date);
            this.close();
        };
    }

    onClose(): void {
        this.options.onClose?.();
    }

    private formatDateTimeLocal(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
}
