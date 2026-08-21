import { exec } from "child_process";
import { Reminder } from "./types";
import { Notice, Platform } from "obsidian";

const execAsync = (command: string, options: { timeout: number }): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
        exec(command, options, (err: unknown, stdout: unknown) => {
            if (err) {
                reject(err instanceof Error ? err : new Error(String(err)));
                return;
            }
            resolve(typeof stdout === "string" ? stdout : String(stdout));
        });
    });
};

export class ReminderStorage {
    private isMac: boolean;
    private listName: string;

    constructor(listName: string = "Inbox") {
        this.isMac = Platform.isMacOS;
        this.listName = listName;
    }

    setListName(listName: string): void {
        this.listName = listName || "Inbox";
    }

    private checkMacOS(): boolean {
        if (!this.isMac) {
            new Notice("此功能仅支持 macOS 系统");
            return false;
        }
        return true;
    }

    private async runJXA(script: string): Promise<string | null> {
        if (!this.checkMacOS()) return null;

        try {
            const stdout = await execAsync(`osascript -l JavaScript -e '${script}'`, {
                timeout: 30000,
            });
            return stdout.trim();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error("[Reminders] JXA Error:", msg);
            new Notice(`操作失败: ${msg}`);
            return null;
        }
    }

    private escapeJXA(str: string): string {
        return str
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n");
    }

    async getAllReminders(): Promise<Reminder[]> {
        const listName = this.escapeJXA(this.listName);
        const script = `ObjC.import("EventKit");var store=$.EKEventStore.alloc.init;var status=$.EKEventStore.authorizationStatusForEntityType(1);if(status!=3){store.requestAccessToEntityTypeCompletion(1,null);delay(3);}var cals=store.calendarsForEntityType(1);var predicate=store.predicateForRemindersInCalendars(cals);var allReminders=store.remindersMatchingPredicate(predicate);var result=[];var valid=function(n,min,max){n=Number(n);return isFinite(n)&&n>=min&&n<=max;};for(var i=0;i<allReminders.count;i++){var r=allReminders.objectAtIndex(i);if(r.completed)continue;var cal=ObjC.unwrap(r.calendar.title);if(cal!=="${listName}")continue;var item={title:ObjC.unwrap(r.title),id:ObjC.unwrap(r.calendarItemIdentifier),list:cal};var comps=r.dueDateComponents;if(comps){var y=Number(comps.year),m=Number(comps.month),d=Number(comps.day);if(valid(y,1,9999)&&valid(m,1,12)&&valid(d,1,31)){var h=Number(comps.hour),minute=Number(comps.minute);if(!valid(h,0,23))h=0;if(!valid(minute,0,59))minute=0;var due=new Date(y,m-1,d,h,minute);if(!isNaN(due.getTime()))item.due=due.toISOString();}}result.push(item);}JSON.stringify(result);`;

        const result = await this.runJXA(script);
        if (!result) return [];

        try {
            const parsed: unknown = JSON.parse(result);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(
                (item): item is Reminder =>
                    item !== null &&
                    typeof item === "object" &&
                    typeof (item as Record<string, unknown>).id === "string" &&
                    typeof (item as Record<string, unknown>).title === "string"
            ).map((item) => {
                const obj = item as Record<string, unknown>;
                return {
                    id: obj.id as string,
                    title: obj.title as string,
                    list: typeof obj.list === "string" ? obj.list : "",
                    due: typeof obj.due === "string" ? obj.due : undefined,
                    completed: false,
                    created: "",
                    updated: "",
                };
            });
        } catch {
            return [];
        }
    }

    async getLists(): Promise<string[]> {
        const script = `ObjC.import("EventKit");var store=$.EKEventStore.alloc.init;var status=$.EKEventStore.authorizationStatusForEntityType(1);if(status!=3){store.requestAccessToEntityTypeCompletion(1,null);delay(3);}var cals=store.calendarsForEntityType(1);var result=[];for(var i=0;i<cals.count;i++){result.push(ObjC.unwrap(cals.objectAtIndex(i).title));}JSON.stringify(result);`;
        const result = await this.runJXA(script);
        if (!result) return ["Inbox"];

        try {
            const parsed: unknown = JSON.parse(result);
            if (!Array.isArray(parsed)) return ["Inbox"];
            return parsed.filter((item): item is string => typeof item === "string");
        } catch {
            return ["Inbox"];
        }
    }

    async addReminder(title: string, due?: string): Promise<boolean> {
        return this.createReminder(title, this.listName, due);
    }

    async createReminder(title: string, listName: string, due?: string): Promise<boolean> {
        const titleEsc = this.escapeJXA(title);
        const listNameEsc = this.escapeJXA(listName);
        const duePart = due
            ? `var d=new Date("${due}");var comps=$.NSDateComponents.alloc.init;comps.year=d.getFullYear();comps.month=d.getMonth()+1;comps.day=d.getDate();comps.hour=d.getHours();comps.minute=d.getMinutes();r.dueDateComponents=comps;`
            : "";
        const script = `ObjC.import("EventKit");var store=$.EKEventStore.alloc.init;var status=$.EKEventStore.authorizationStatusForEntityType(1);if(status!=3){store.requestAccessToEntityTypeCompletion(1,null);delay(3);}var cals=store.calendarsForEntityType(1);var targetCal=null;for(var i=0;i<cals.count;i++){var cal=cals.objectAtIndex(i);if(ObjC.unwrap(cal.title)==="${listNameEsc}"){targetCal=cal;break;}}if(!targetCal){"calendar not found";}else{var r=$.EKReminder.reminderWithEventStore(store);r.title=$("${titleEsc}");r.calendar=targetCal;${duePart}var error=$();store.saveReminderCommitError(r,true,error);error.js?error.js.localizedDescription:"ok";}`;

        const result = await this.runJXA(script);
        if (result === "ok") {
            new Notice("提醒已添加");
            return true;
        }
        return false;
    }

    async deleteReminder(id: string): Promise<boolean> {
        const idEsc = this.escapeJXA(id);
        const script = `ObjC.import("EventKit");var store=$.EKEventStore.alloc.init;var item=store.calendarItemWithIdentifier("${idEsc}");if(!item){"not found";}else{var error=$();store.removeReminderCommitError(item,true,error);error.js?error.js.localizedDescription:"ok";}`;

        const result = await this.runJXA(script);
        if (result === "ok") {
            new Notice("提醒已删除");
            return true;
        }
        return false;
    }

    async updateReminder(id: string, title: string, due?: string): Promise<boolean> {
        const idEsc = this.escapeJXA(id);
        const titleEsc = this.escapeJXA(title);
        const duePart = due
            ? `var d=new Date("${due}");var comps=$.NSDateComponents.alloc.init;comps.year=d.getFullYear();comps.month=d.getMonth()+1;comps.day=d.getDate();comps.hour=d.getHours();comps.minute=d.getMinutes();r.dueDateComponents=comps;`
            : "r.dueDateComponents=null;";
        const script = `ObjC.import("EventKit");var store=$.EKEventStore.alloc.init;var item=store.calendarItemWithIdentifier("${idEsc}");if(!item){"not found";}else{item.title=$("${titleEsc}");${duePart}var error=$();store.saveReminderCommitError(item,true,error);error.js?error.js.localizedDescription:"ok";}`;

        const result = await this.runJXA(script);
        if (result === "ok") {
            new Notice("提醒已更新");
            return true;
        }
        return false;
    }

    async toggleComplete(id: string): Promise<boolean> {
        const idEsc = this.escapeJXA(id);
        const script = `ObjC.import("EventKit");var store=$.EKEventStore.alloc.init;var item=store.calendarItemWithIdentifier("${idEsc}");if(!item){"not found";}else{item.completed=true;var error=$();store.saveReminderCommitError(item,true,error);error.js?error.js.localizedDescription:"ok";}`;

        const result = await this.runJXA(script);
        if (result === "ok") {
            new Notice("提醒已完成");
            return true;
        }
        return false;
    }

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
