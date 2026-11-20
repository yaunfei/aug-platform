import browserslist from "browserslist";
export function isNodeTarget(target) {
    var _a;
    if (target === undefined)
        return false;
    try {
        const [distribution] = browserslist(target.split(","), {
            ignoreUnknownVersions: true,
        });
        return (_a = distribution === null || distribution === void 0 ? void 0 : distribution.startsWith("node ")) !== null && _a !== void 0 ? _a : false;
    }
    catch (_b) {
        // Match Config::platform(): `node` is also the explicit fallback when the
        // target isn't a valid Browserslist query.
        return target === "node";
    }
}
