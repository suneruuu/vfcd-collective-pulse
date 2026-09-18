const assert = require("node:assert/strict");
const http = require("node:http");
const { createClient } = require("@supabase/supabase-js");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const load = require("./helpers/load-module.cjs");
const { createCloudApi } = load("src/services/cloudApi.js");
const { createCloudConnection } = load("src/services/cloudConnection.js");
const { VoteShell } = load("src/vote/VotePage.jsx");
const Queue = load("shared/prompt-queue.js").default;

async function main() {
  const campaign = {
    startMs: Date.parse("2026-09-21T00:00:00+07:00"),
    days: 7,
    openHour: 9,
    closeHour: 18,
  };
  const now = campaign.startMs + 12 * 3600000;
  const records = [],
    receipts = new Map(),
    requestIds = [];
  let dropNext = false;
  const queue = {
    version: 1,
    revision: 0,
    prompts: Queue.defaults.map((item) => ({ ...item })),
    installation: { online: true, cloud: true, revision: 0 },
    sharedPrompts: { dayIndex: 0, currentId: null, visible: [] },
  };
  const server = http.createServer(async (request, response) => {
    try {
      assert.equal(request.headers.apikey, "sb_publishable_test");
      let body = "";
      for await (const chunk of request) body += chunk;
      const args = JSON.parse(body);
      let result;
      if (request.url === "/rest/v1/rpc/pulse_read") {
        const votes = args.p_include_votes ? records.filter((vote) => vote.id > args.p_after) : [];
        result = {
          serverNow: now,
          campaign,
          votes,
          cursor: votes.at(-1)?.id || args.p_after,
          hasMore: false,
          queue,
        };
      } else if (request.url === "/rest/v1/rpc/pulse_submit") {
        requestIds.push(args.p_request_id);
        if (!receipts.has(args.p_request_id)) {
          const votes = args.p_choices.map((choice) => {
            const vote = { id: records.length + 1, timestamp: now, choice };
            records.push(vote);
            return vote;
          });
          receipts.set(args.p_request_id, { votes });
        }
        result = receipts.get(args.p_request_id);
        if (dropNext) {
          dropNext = false;
          response.destroy();
          return;
        }
      } else if (request.url === "/rest/v1/rpc/pulse_update_queue") {
        response.writeHead(403, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ code: "PT403", message: "Administrator access required." }));
        return;
      } else throw new Error("Unexpected SDK route: " + request.url);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ code: "TEST", message: error.message }));
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const client = createClient(
      "http://127.0.0.1:" + server.address().port,
      "sb_publishable_test",
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
    const api = createCloudApi(client);
    const scheduler = { setInterval: () => 1, clearInterval() {} };
    const viewA = new Map(),
      viewB = new Map();
    function connection(view, includeVotes = true) {
      return createCloudConnection({
        api,
        includeVotes,
        scheduler,
        clock: { now: () => now },
        onVotes: (votes) => {
          for (const vote of votes) view.set(vote.id, vote);
        },
      });
    }
    const displayA = connection(viewA),
      displayB = connection(viewB),
      phone = connection(new Map(), false);
    await Promise.all([displayA.syncOnce(), displayB.syncOnce(), phone.syncOnce()]);
    assert.equal(await phone.submit([1, 1]), true);
    assert.equal(await displayA.submit([-1]), true);
    await Promise.all([displayA.syncOnce(), displayB.syncOnce()]);
    assert.equal(viewA.size, 3);
    assert.deepEqual(
      [...viewA.values()].sort((a, b) => a.id - b.id),
      [...viewB.values()],
    );
    assert.deepEqual(
      [...viewB.values()].map((vote) => vote.choice),
      [1, 1, -1],
    );

    dropNext = true;
    assert.equal(await phone.submit([1]), false, "A lost acknowledgement must pause voting");
    assert.equal(phone.canVote(), false);
    await phone.syncOnce();
    assert.equal(phone.canVote(), true);
    assert.equal(records.length, 4, "An uncertain retry must not create another response");
    assert.equal(requestIds.at(-1), requestIds.at(-2));
    await displayB.syncOnce();
    assert.equal(viewB.size, 4);
    await assert.rejects(
      api.updateQueue({ revision: 0, operation: "edit" }),
      (error) => error.status === 403,
    );
    assert.equal((await api.getQueue()).revision, 0);

    const html = renderToStaticMarkup(React.createElement(VoteShell, { enabled: true, input: {} }));
    assert.equal((html.match(/<button/g) || []).length, 2);
    assert(html.includes("YES") && html.includes("NO") && html.includes("Does Vietnam"));
    assert(!html.includes("<canvas") && !html.includes("Question Queue"));
    const offline = renderToStaticMarkup(
      React.createElement(VoteShell, { enabled: false, message: "Reconnecting...", input: {} }),
    );
    assert.equal((offline.match(/disabled=""/g) || []).length, 2);
    assert(offline.includes('role="status"') && offline.includes("Reconnecting..."));
    console.log(
      "SDK/HTTP checks passed: phone and kiosk share results, two displays converge, lost acknowledgements deduplicate, and the voting page has only its question and two controls.",
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
