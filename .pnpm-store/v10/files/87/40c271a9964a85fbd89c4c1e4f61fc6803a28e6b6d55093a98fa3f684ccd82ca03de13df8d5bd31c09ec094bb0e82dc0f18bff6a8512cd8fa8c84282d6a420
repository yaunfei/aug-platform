"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const target_1 = require("./target");
(0, vitest_1.describe)("isNodeTarget", () => {
    vitest_1.it.each(["node", "current node", "maintained node versions", "node >= 20"])("recognizes the Node target %s", (target) => {
        (0, vitest_1.expect)((0, target_1.isNodeTarget)(target)).toBe(true);
    });
    vitest_1.it.each([undefined, "web", "last 1 Chrome versions"])("keeps the web target %s on the client watcher", (target) => {
        (0, vitest_1.expect)((0, target_1.isNodeTarget)(target)).toBe(false);
    });
    (0, vitest_1.it)("matches the first resolved distribution for mixed queries", () => {
        (0, vitest_1.expect)((0, target_1.isNodeTarget)("last 1 Chrome versions, current node")).toBe(false);
    });
});
