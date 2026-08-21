import assert from "node:assert/strict";
import test from "node:test";
import {
    REMINDERS_AUTHORIZATION_INSTRUCTIONS,
    classifyRemindersAuthorization,
    parseRemindersResult,
} from "../reminders-result.ts";

void test("provides the exact macOS Reminders authorization path", () => {
    assert.equal(
        REMINDERS_AUTHORIZATION_INSTRUCTIONS,
        "授权步骤：打开“系统设置 → 隐私与安全性 → 提醒事项”，勾选 Obsidian，然后重启 Obsidian。"
    );
});

void test("classifies every documented EventKit authorization status", () => {
    assert.equal(classifyRemindersAuthorization(0), "unavailable");
    assert.equal(classifyRemindersAuthorization(1), "unavailable");
    assert.equal(classifyRemindersAuthorization(2), "denied");
    assert.equal(classifyRemindersAuthorization(3), "full-access");
    assert.equal(classifyRemindersAuthorization(4), "unavailable");
});

void test("does not guess authorization for unknown or incorrectly typed statuses", () => {
    assert.equal(classifyRemindersAuthorization(5), "unavailable");
    assert.equal(classifyRemindersAuthorization("2"), "unavailable");
    assert.equal(classifyRemindersAuthorization(null), "unavailable");
    assert.equal(classifyRemindersAuthorization(undefined), "unavailable");
});

void test("reports EventKit denied status 2 as denied", () => {
    assert.deepEqual(
        parseRemindersResult(JSON.stringify({ authorizationStatus: 2, reminders: [] })),
        { authorization: "denied", reminders: [] }
    );
});

void test("does not expose reminder data when access is denied", () => {
    assert.deepEqual(
        parseRemindersResult(
            JSON.stringify({
                authorizationStatus: 2,
                reminders: [{ id: "private", title: "should not be returned" }],
            })
        ),
        { authorization: "denied", reminders: [] }
    );
});

void test("keeps non-denied statuses distinct from an authorized empty list", () => {
    for (const authorizationStatus of [0, 1, 4, 5]) {
        assert.deepEqual(
            parseRemindersResult(JSON.stringify({ authorizationStatus, reminders: [] })),
            { authorization: "unavailable", reminders: [] }
        );
    }

    assert.deepEqual(
        parseRemindersResult(JSON.stringify({ authorizationStatus: 3, reminders: [] })),
        { authorization: "full-access", reminders: [] }
    );
});

void test("maps valid Inbox reminders when full access is granted", () => {
    const result = parseRemindersResult(
        JSON.stringify({
            authorizationStatus: 3,
            reminders: [
                {
                    id: "reminder-1",
                    title: "Inbox item",
                    list: "Inbox",
                    due: "2026-08-21T08:00:00.000Z",
                },
                { id: "reminder-2", title: "No due date", list: "Inbox" },
            ],
        })
    );

    assert.deepEqual(result, {
        authorization: "full-access",
        reminders: [
            {
                id: "reminder-1",
                title: "Inbox item",
                list: "Inbox",
                due: "2026-08-21T08:00:00.000Z",
                completed: false,
                created: "",
                updated: "",
            },
            {
                id: "reminder-2",
                title: "No due date",
                list: "Inbox",
                due: undefined,
                completed: false,
                created: "",
                updated: "",
            },
        ],
    });
});

void test("filters malformed reminder items without discarding valid items", () => {
    const result = parseRemindersResult(
        JSON.stringify({
            authorizationStatus: 3,
            reminders: [
                null,
                "invalid",
                { id: 1, title: "invalid id" },
                { id: "missing-title" },
                { id: "valid", title: "Valid", list: 123, due: false },
            ],
        })
    );

    assert.deepEqual(result, {
        authorization: "full-access",
        reminders: [
            {
                id: "valid",
                title: "Valid",
                list: "",
                due: undefined,
                completed: false,
                created: "",
                updated: "",
            },
        ],
    });
});

void test("reports missing or malformed responses as unavailable", () => {
    const invalidOutputs = [
        null,
        "",
        "not-json",
        "[]",
        "null",
        JSON.stringify({}),
        JSON.stringify({ authorizationStatus: 3 }),
        JSON.stringify({ authorizationStatus: 3, reminders: {} }),
        JSON.stringify({ authorizationStatus: "3", reminders: [] }),
    ];

    for (const output of invalidOutputs) {
        assert.deepEqual(parseRemindersResult(output), {
            authorization: "unavailable",
            reminders: [],
        });
    }
});
