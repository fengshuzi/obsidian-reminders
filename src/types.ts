export interface Reminder {
    id: string;
    title: string;
    list: string;
    due?: string;
    completed: boolean;
    created: string;
    updated: string;
    notes?: string;
}
