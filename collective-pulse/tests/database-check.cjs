const assert = require("node:assert/strict");
const Queue = require("./helpers/load-module.cjs")("shared/prompt-queue.js").default;
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawnSync, spawn } = require("node:child_process");

const candidates = [
  process.env.PULSE_POSTGRES_BIN,
  "C:/Program Files/PostgreSQL/17/bin",
  "/usr/lib/postgresql/18/bin",
  "/usr/lib/postgresql/17/bin",
  "/usr/lib/postgresql/16/bin",
  "/usr/local/opt/postgresql@17/bin",
].filter(Boolean);
const suffix = process.platform === "win32" ? ".exe" : "";
const bin = candidates.find((candidate) => fs.existsSync(path.join(candidate, "initdb" + suffix)));
if (!bin)
  throw new Error("Install PostgreSQL or set PULSE_POSTGRES_BIN to run isolated database checks.");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pulse-db-"));
const dataDir = path.join(temp, "data");
const serverLog = path.join(temp, "postgres.log");
const controlLog = path.join(temp, "pg_ctl.log");
let port,
  started = false;
function command(name, args, input) {
  // Files preserve startup diagnostics without leaving pipes open in the
  // background PostgreSQL process (which can block spawnSync on Windows).
  const output = name === "pg_ctl" ? fs.openSync(controlLog, "w") : undefined;
  let result;
  try {
    result = spawnSync(path.join(bin, name + suffix), args, {
      input,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      ...(output !== undefined ? { stdio: ["ignore", output, output] } : {}),
    });
  } finally {
    if (output !== undefined) fs.closeSync(output);
  }
  if (output !== undefined) result.stdout = fs.readFileSync(controlLog, "utf8");
  return result;
}
function checked(name, args, input) {
  const result = command(name, args, input);
  if (result.error || result.status !== 0) {
    const details = [result.error?.message, result.stderr, result.stdout];
    if (name === "pg_ctl" && fs.existsSync(serverLog))
      details.push(fs.readFileSync(serverLog, "utf8"));
    throw new Error(
      ["PostgreSQL " + name + " failed (exit " + result.status + ").", ...details]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return (result.stdout || "").trim();
}
const psqlArgs = () => [
  "-X",
  "-qAt",
  "-h",
  "127.0.0.1",
  "-p",
  String(port),
  "-U",
  "pulse_test",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
function sql(statement, role, userId) {
  const prefix = role ? `set role ${role}; set request.jwt.claim.sub = '${userId || ""}'; ` : "";
  return checked("psql", [...psqlArgs(), "-c", prefix + statement]);
}
function json(statement, role, userId) {
  return JSON.parse(sql(statement, role, userId));
}
function rejected(statement, pattern, role = "anon", userId) {
  const prefix = `set role ${role}; set request.jwt.claim.sub = '${userId || ""}'; `;
  const result = command("psql", [...psqlArgs(), "-c", prefix + statement]);
  assert.notEqual(result.status, 0, "Unsafe request unexpectedly succeeded: " + statement);
  assert.match(result.stderr, pattern);
}
function parallelSql(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(bin, "psql" + suffix), [...psqlArgs(), "-c", statement], {
      windowsHide: true,
    });
    let output = "",
      errors = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (errors += chunk));
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve(output.trim()) : reject(new Error(errors))));
  });
}
async function main() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  checked("initdb", [
    "-D",
    dataDir,
    "-U",
    "pulse_test",
    "--auth=trust",
    "--no-locale",
    "--encoding=UTF8",
  ]);
  // The suite connects over TCP. Linux packages can default to a protected
  // system socket directory, which a regular CI user cannot write to.
  fs.appendFileSync(path.join(dataDir, "postgresql.conf"), "\nunix_socket_directories = ''\n");
  started = true;
  checked("pg_ctl", [
    "-D",
    dataDir,
    "-l",
    serverLog,
    "-o",
    `-p ${port} -h 127.0.0.1`,
    "-w",
    "start",
  ]);
  sql(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  checked("psql", [
    ...psqlArgs(),
    "-f",
    path.join(__dirname, "../supabase/migrations/202609190001_collective_pulse.sql"),
  ]);
  assert.deepEqual(json("select prompts from pulse_private.campaign"), Queue.defaults);
  assert.equal(sql("select count(*) from pulse_private.votes"), "0");
  rejected("select * from pulse_private.votes", /permission denied/);
  rejected("update pulse_private.campaign set revision = 999", /permission denied/);
  rejected("select pulse_private.refresh_campaign()", /permission denied/);
  rejected("select public.pulse_update_queue('{}')", /permission denied/);
  rejected("select public.pulse_update_queue('{}')", /Administrator access/, "authenticated");
  rejected("select public.pulse_read(-1, true)", /Invalid vote cursor/);
  rejected("select public.pulse_submit(gen_random_uuid(), array[0])", /Choose YES or NO/);
  rejected("select public.pulse_submit(gen_random_uuid(), array[null]::int[])", /Choose YES or NO/);
  rejected(
    "select public.pulse_submit(gen_random_uuid(), array_fill(1, array[257]))",
    /Choose YES or NO/,
  );

  const today = sql("select (clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date");
  sql(`update pulse_private.campaign set start_date = '${today}'::date + 1`);
  rejected("select public.pulse_submit(gen_random_uuid(), array[1])", /Voting is currently closed/);
  sql(`update pulse_private.campaign set start_date = '${today}'::date - 7`);
  rejected("select public.pulse_submit(gen_random_uuid(), array[1])", /Voting is currently closed/);
  sql(`update pulse_private.campaign set start_date = '${today}', open_hour = 0, close_hour = 24`);
  const requestId = "00000000-0000-4000-8000-000000000001";
  const receipt = json(`select public.pulse_submit('${requestId}', array[1,-1,1])`, "anon");
  assert.equal(receipt.votes.length, 3);
  assert.equal(new Set(receipt.votes.map((vote) => vote.timestamp)).size, 1);
  assert.deepEqual(
    json(`select public.pulse_submit('${requestId}', array[1,-1,1])`, "anon"),
    receipt,
  );
  rejected(`select public.pulse_submit('${requestId}', array[-1])`, /another sample/);
  const first = json("select public.pulse_read(0, true)", "anon");
  assert.deepEqual(first.votes, receipt.votes);
  assert.equal(first.cursor, 3);
  assert.equal(json("select public.pulse_read(3, true)", "anon").votes.length, 0);
  assert.equal(json("select public.pulse_read(0, false)", "anon").votes.length, 0);
  const second = json("select public.pulse_read(0, false)", "anon");
  assert.deepEqual(
    first.queue.sharedPrompts,
    second.queue.sharedPrompts,
    "Reading on another display must not advance the question clock",
  );

  const adminId = "11111111-1111-4111-8111-111111111111";
  sql(
    `insert into auth.users values ('${adminId}'); insert into pulse_private.admins values ('${adminId}')`,
  );
  assert.equal(json("select to_json(public.pulse_is_admin())", "authenticated", adminId), true);
  assert.equal(json("select to_json(public.pulse_is_admin())", "authenticated"), false);
  function update(operation) {
    return json(
      "select public.pulse_update_queue('" +
        JSON.stringify(operation).replace(/'/g, "''") +
        "'::jsonb)",
      "authenticated",
      adminId,
    );
  }
  rejected(
    `select public.pulse_update_queue('{"operation":"edit","id":"default-13","text":"No revision"}')`,
    /queue changed/,
    "authenticated",
    adminId,
  );
  const edited = update({
    revision: 0,
    operation: "edit",
    id: "default-13",
    text: "  A shared question?  ",
  });
  assert.equal(edited.prompts[0].text, "A shared question?");
  rejected(
    `select public.pulse_update_queue('{"revision":0,"operation":"edit","id":"default-13","text":"Stale"}')`,
    /queue changed/,
    "authenticated",
    adminId,
  );
  const beforeNext = json("select public.pulse_read(0, false)", "anon").queue;
  const added = update({
    revision: 1,
    operation: "add",
    position: "next",
    text: "An immediate next question?",
  });
  const newPrompt = added.prompts.find((prompt) => prompt.text === "An immediate next question?");
  assert.equal(added.installation.nextId, newPrompt.id);
  const previousIndex = added.prompts.findIndex(
    (prompt) => prompt.id === beforeNext.installation.currentId,
  );
  if (previousIndex >= 0) assert.equal(added.prompts[previousIndex + 1].id, newPrompt.id);
  const hidden = update({ revision: 2, operation: "visibility", id: newPrompt.id, hidden: true });
  assert.notEqual(hidden.installation.nextId, newPrompt.id);
  const reordered = update({
    revision: 3,
    operation: "reorder",
    ids: hidden.prompts.map((prompt) => prompt.id).reverse(),
  });
  assert.equal(reordered.revision, 4);
  const currentIndex = reordered.prompts.findIndex(
    (prompt) => prompt.id === reordered.installation.currentId,
  );
  if (currentIndex >= 0) {
    const candidates = [
      ...reordered.prompts.slice(currentIndex + 1),
      ...reordered.prompts.slice(0, currentIndex + 1),
    ];
    assert.equal(
      reordered.installation.nextId,
      candidates.find((prompt) => !prompt.hidden)?.id || null,
      "Reordering must update the next question relative to the shared current question",
    );
  }
  rejected(
    `select public.pulse_update_queue('{"revision":4,"operation":"reorder","ids":[]}')`,
    /exactly once/,
    "authenticated",
    adminId,
  );
  assert.equal(
    sql("select count(*) from pulse_private.votes"),
    "3",
    "Editing questions must preserve votes",
  );

  // Closed-hours rejection uses the server clock; no client timestamp is accepted.
  sql(`update pulse_private.campaign set open_hour = case when extract(hour from clock_timestamp() at time zone timezone) = 0 then 1 else 0 end,
    close_hour = case when extract(hour from clock_timestamp() at time zone timezone) = 0 then 24 else extract(hour from clock_timestamp() at time zone timezone)::integer end`);
  rejected("select public.pulse_submit(gen_random_uuid(), array[1])", /Voting is currently closed/);
  assert.deepEqual(
    json(`select public.pulse_submit('${requestId}', array[1,-1,1])`, "anon"),
    receipt,
    "A confirmed batch remains idempotent after closing",
  );

  // A transaction holding the campaign row cannot expose a higher ID first.
  sql("update pulse_private.campaign set open_hour = 0, close_hour = 24");
  const slow = parallelSql(
    "begin; select public.pulse_submit(gen_random_uuid(), array[1]); select pg_sleep(0.3); commit;",
  );
  await new Promise((resolve) => setTimeout(resolve, 80));
  const fast = parallelSql("select public.pulse_submit(gen_random_uuid(), array[-1]);");
  await Promise.all([slow, fast]);
  assert.deepEqual(
    json("select public.pulse_read(3, true)", "anon").votes.map((vote) => vote.id),
    [4, 5],
  );

  // Exercise >1000 records and catch-up after several unattended days.
  for (let i = 0; i < 4; i++)
    json("select public.pulse_submit(gen_random_uuid(), array_fill(1, array[256]))", "anon");
  const page = json("select public.pulse_read(0, true)", "anon");
  assert.equal(page.votes.length, 1000);
  assert.equal(page.hasMore, true);
  const tail = json(`select public.pulse_read(${page.cursor}, true)`, "anon");
  assert.equal(tail.votes.length, 29);
  assert.equal(tail.hasMore, false);
  sql(
    `update pulse_private.campaign set start_date = '${today}'::date - 2, processed_slots = 0, visible = '[]', next_id = 'default-13'`,
  );
  const catchup = json("select public.pulse_read(0, false)", "anon");
  assert.equal(catchup.queue.sharedPrompts.dayIndex, 2);
  assert(catchup.queue.sharedPrompts.visible.length <= 5);
  assert(Number(sql("select processed_slots from pulse_private.campaign")) >= 574);
  for (const item of catchup.queue.sharedPrompts.visible)
    assert.equal(new Date(item.shownAt + 7 * 3600000).toISOString().slice(0, 10), today);
  console.log(
    "Database checks passed: access control, server hours, idempotency, shared rotation, queue conflicts, concurrent votes, and pagination.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    let stopped = !started;
    if (started) {
      const result = command("pg_ctl", ["-D", dataDir, "-m", "immediate", "-w", "stop"]);
      stopped = result.status === 0;
    }
    // Validate the exact temporary directory before recursive cleanup.
    if (
      stopped &&
      fs.realpathSync(path.dirname(temp)) === fs.realpathSync(os.tmpdir()) &&
      path.basename(temp).startsWith("pulse-db-")
    )
      fs.rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
