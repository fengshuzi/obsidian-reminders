import type { Reminder } from "./types";

export const REMINDERS_AUTHORIZATION_INSTRUCTIONS =
    "授权步骤：打开“系统设置 → 隐私与安全性 → 提醒事项”，勾选 Obsidian，然后重启 Obsidian。";

export type RemindersAuthorization = "full-access" | "denied" | "unavailable";

export interface RemindersLoadResult {
    authorization: RemindersAuthorization;
    reminders: Reminder[];
}

export function classifyRemindersAuthorization(status: unknown): RemindersAuthorization {
    if (status === 3) return "full-access";
    if (status === 2) return "denied";
    return "unavailable";
}

export function parseRemindersResult(output: string | null): RemindersLoadResult {
    if (!output) return unavailableResult();

    try {
        const parsed: unknown = JSON.parse(output);
        if (!isRecord(parsed)) return unavailableResult();

        const authorization = classifyRemindersAuthorization(parsed.authorizationStatus);
        if (authorization !== "full-access") {
            return { authorization, reminders: [] };
        }
        if (!Array.isArray(parsed.reminders)) return unavailableResult();

        return {
            authorization,
            reminders: parsed.reminders.flatMap((item) => {
                const reminder = parseReminder(item);
                return reminder ? [reminder] : [];
            }),
        };
    } catch {
        return unavailableResult();
    }
}

function unavailableResult(): RemindersLoadResult {
    return { authorization: "unavailable", reminders: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseReminder(value: unknown): Reminder | null {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") {
        return null;
    }

    return {
        id: value.id,
        title: value.title,
        list: typeof value.list === "string" ? value.list : "",
        due: typeof value.due === "string" ? value.due : undefined,
        completed: false,
        created: "",
        updated: "",
    };
}
