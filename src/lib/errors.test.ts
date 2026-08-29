import assert from "node:assert/strict";
import test from "node:test";
import { categorizeError, createGitHubIssueUrl, redactErrorText, type AppError } from "./errors.ts";

test("categorizes common failures", () => {
  assert.equal(categorizeError(new Error("fetch timed out")), "network");
  assert.equal(categorizeError(new Error("rate limit from model")), "provider");
  assert.equal(categorizeError(new Error("SQLite is locked")), "storage");
});

test("redacts secrets and local usernames from reports", () => {
  const redacted = redactErrorText("Authorization: Bearer abc123 C:\\Users\\domen\\app token=secret");
  assert.equal(redacted.includes("abc123"), false);
  assert.equal(redacted.includes("domen"), false);
  assert.equal(redacted.includes("secret"), false);
});

test("creates a prefilled GitHub issue URL", () => {
  const error: AppError = {
    id: "1",
    category: "render",
    message: "Panel failed",
    source: "React",
    occurredAt: 0,
    occurrences: 1,
  };
  const url = new URL(createGitHubIssueUrl("https://github.com/Yivani/Black-One", error));
  assert.equal(url.pathname, "/Yivani/Black-One/issues/new");
  assert.match(url.searchParams.get("title") ?? "", /Panel failed/);
});
