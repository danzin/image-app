export function test(e: unknown) { if (e && typeof e === "object" && "message" in e) return e.message; return ""; }
