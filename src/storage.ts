import { exec } from "child_process";
import { promisify } from "util";
import { Reminder } from "./types";
import { Notice, Platform } from "obsidian";

const execAsync = promisify(exec);

export class ReminderStorage {
    private isMac: boolean;
    private listName: string;

    constructor(listName: string = "Inbox") {
        this.isMac = Platform.isMacOS;
        this.listName = listName;
    }

    // 设置列表名称
    setListName(listName: string): void {
        this.listName = listName || "Inbox";
    }

    // ========== macOS 检查 ==========
    private checkMacOS(): boolean {
        if (!this.isMac) {
            new Notice("此功能仅支持 macOS 系统");
            return false;
        }
        return true;
    }

    // ========== JXA 脚本 ==========
    private async runJXA(script: string): Promise<any> {
        if (!this.checkMacOS()) return null;

        try {
            const { stdout } = await execAsync(`osascript -l JavaScript -e "${script}"`, {
                timeout: 30000,
            });
            return stdout.trim();
        } catch (error) {
            console.error("[Reminders] JXA Error:", error);
            new Notice("执行提醒事项操作失败");
            return null;
        }
    }

    // ========== 查询所有提醒 (查询配置的列表) ==========
    async getAllReminders(): Promise<Reminder[]> {
        const script = `
var Reminders=Application('Reminders');
var result={};
var lists=Reminders.lists();
var listCount=lists.length;
for(var i=0;i<listCount;i++){
    var list=lists[i];
    var listName=list.name();
    if(listName!=='${this.listName}')continue;
    var reminders=list.reminders.whose({completed:false})();
    var reminderCount=reminders.length;
    result[listName]=[];
    for(var j=0;j<reminderCount;j++){
        var r=reminders[j];
        var item={title:r.name(),id:r.id()};
        var dueDate=r.dueDate();
        if(dueDate&&dueDate.toString()!=='missing value'){
            item.due=dueDate.toISOString();
        }
        result[listName].push(item);
    }
    break;
}
JSON.stringify(result);
        `.replace(/\n/g, "");

        const result = await this.runJXA(script);
        if (!result) return [];

        try {
            const data = JSON.parse(result);
            const reminders: Reminder[] = [];

            for (const [listName, items] of Object.entries(data)) {
                for (const item of items as any[]) {
                    reminders.push({
                        id: item.id,
                        title: item.title,
                        list: listName,
                        due: item.due,
                        completed: false,
                        created: "",
                        updated: "",
                    });
                }
            }

            return reminders;
        } catch (error) {
            console.error("[Reminders] Parse Error:", error);
            return [];
        }
    }

    // ========== 获取所有列表 ==========
    async getLists(): Promise<string[]> {
        const script = `var Reminders=Application('Reminders');JSON.stringify(Reminders.lists().map(function(l){return l.name();}));`;
        const result = await this.runJXA(script);
        if (!result) return ["Inbox"];

        try {
            return JSON.parse(result);
        } catch {
            return ["Inbox"];
        }
    }

    // ========== 增 (Create) ==========
    async addReminder(title: string, due?: string): Promise<boolean> {
        return this.createReminder(title, this.listName, due);
    }

    async createReminder(title: string, listName: string, due?: string): Promise<boolean> {
        const duePart = due ? `,dueDate:new Date('${due}')` : "";
        const script = `
var Reminders=Application('Reminders');
var list=Reminders.lists.whose({name:'${listName}'})[0];
var r=Reminders.Reminder({name:'${title}'${duePart}});
list.reminders.push(r);
'ok';
        `.replace(/\n/g, "");

        const result = await this.runJXA(script);
        if (result) {
            new Notice("提醒已添加");
            return true;
        }
        return false;
    }

    // ========== 删 (Delete) ==========
    async deleteReminder(id: string): Promise<boolean> {
        const script = `var Reminders=Application('Reminders');var r=Reminders.reminders.byId('${id}');r.delete();'ok';`;
        const result = await this.runJXA(script);
        if (result) {
            new Notice("提醒已删除");
            return true;
        }
        return false;
    }

    // ========== 改 (Update) ==========
    async updateReminder(id: string, title: string, due?: string): Promise<boolean> {
        const duePart = due ? `r.dueDate=new Date('${due}');` : "r.dueDate=null;";
        const script = `var Reminders=Application('Reminders');var r=Reminders.reminders.byId('${id}');r.name='${title}';${duePart}'ok';`;
        const result = await this.runJXA(script);
        if (result) {
            new Notice("提醒已更新");
            return true;
        }
        return false;
    }

    // ========== 完成提醒 ==========
    async toggleComplete(id: string): Promise<boolean> {
        const script = `var Reminders=Application('Reminders');var r=Reminders.reminders.byId('${id}');r.completed=true;'ok';`;
        const result = await this.runJXA(script);
        if (result) {
            new Notice("提醒已完成");
            return true;
        }
        return false;
    }

    // ========== 辅助方法（兼容现有接口） ==========
    getActiveReminders(): Reminder[] {
        return [];
    }

    sortReminders(reminders: Reminder[], sortBy: "due" | "created" | "title"): Reminder[] {
        return [...reminders].sort((a, b) => {
            switch (sortBy) {
                case "due":
                    if (!a.due && !b.due) return 0;
                    if (!a.due) return 1;
                    if (!b.due) return -1;
                    return new Date(a.due).getTime() - new Date(b.due).getTime();
                case "title":
                    return a.title.localeCompare(b.title);
                default:
                    return 0;
            }
        });
    }
}
