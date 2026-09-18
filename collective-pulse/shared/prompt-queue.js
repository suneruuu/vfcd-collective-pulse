const texts = [
  "Do we still need festivals?",
  "Can a festival change how you see your city?",
  "Should a festival surprise you?",
  "Should a festival make you uncomfortable?",
  "Can strangers become a temporary community?",
  "Can creativity bring people together?",
  "Does a festival need a stage?",
  "Does a festival need an audience?",
  "Can a festival exist without performances?",
  "Can a festival happen anywhere?",
  "Can the whole city become a festival?",
  "Does a festival end when the programme ends?",
  "Are audiences part of the festival?",
  "Should audiences help decide what happens next?",
  "Should audiences become co-producers rather than spectators?",
  "Can participation be more important than programming?",
  "Should a festival give up some control to its audience?",
  "Would you help shape the next festival?",
  "Does a festival belong to the city where it happens?",
  "Should a festival respond to the problems of its city?",
  "Should festivals happen outside cultural venues?",
  "Can a festival change how public space is used?",
  "Should local communities have more influence than international guests?",
  "Could festivals help shape Vietnam's cultural future?",
  "Can you be fully present at a festival through a phone?",
  "Does technology bring audiences closer together?",
  "Should AI have a role in shaping a festival?",
  "Could an algorithm curate a festival you would trust?",
  "Should a festival know what its audience is feeling in real time?",
  "Would you change your answer after seeing everyone else's answers?",
  "Does a festival have to attract large audiences to be successful?",
  "Does a festival have to make money to survive?",
  "Can a festival be valuable even if it fails?",
  "Should festivals spend resources on experiments that might not work?",
  "Is cultural value more important than economic value?",
  "Should a festival produce something that lasts?",
  "Should institutions control festivals?",
  "Should artists have more power than sponsors?",
  "Should communities have more power than organisers?",
  "Can a festival remain independent if it depends on sponsorship?",
  "Should everyone have equal access to a festival?",
  "Can a festival genuinely belong to everyone?",
  "Can a festival be alive?",
  "Can a festival learn from its audience?",
  "Should a festival change while it is happening?",
  "Should today's audience change tomorrow's programme?",
  "Can disagreement make a festival stronger?",
  "Is this festival different now because you are here?",
  "Should the festival of the future look different from today's festival?",
  "Could a festival exist without a fixed programme?",
  "Could a festival continue all year?",
  "Could a festival be a laboratory rather than an event?",
  "Could festivals help imagine different futures for society?",
  "Can festivals change the future?",
  "Did this festival change your mind about something?",
  "Did you feel part of this festival?",
  "Did you encounter someone you would not normally meet?",
  "Would you like more festivals like this in Vietnam?",
  "Should this festival return?",
  "Should the next festival be shaped by what we answered here?",
];
// Keep the new questions' IDs; default-1 through default-12 are retired.
const defaults = Object.freeze(
  texts.map((text, index) =>
    Object.freeze({
      id: `default-${index + 13}`,
      text,
      hidden: false,
    }),
  ),
);
function cleanText(text) {
  if (typeof text !== "string" || !text.trim() || text.trim().length > 240) {
    throw new Error("Enter a question between 1 and 240 characters.");
  }
  return text.trim();
}
function validate(document) {
  if (
    !document ||
    document.version !== 1 ||
    !Number.isSafeInteger(document.revision) ||
    document.revision < 0 ||
    !Array.isArray(document.prompts) ||
    document.prompts.length > 500
  ) {
    throw new Error("Invalid question queue.");
  }
  const ids = new Set();
  const prompts = document.prompts.map((prompt) => {
    if (
      !prompt ||
      typeof prompt.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(prompt.id) ||
      ids.has(prompt.id) ||
      typeof prompt.hidden !== "boolean"
    )
      throw new Error("Invalid question.");
    ids.add(prompt.id);
    return {
      id: prompt.id,
      text: cleanText(prompt.text),
      hidden: prompt.hidden,
    };
  });
  return {
    version: 1,
    revision: document.revision,
    prompts,
  };
}
function nextIndex(prompts, start = 0) {
  for (let offset = 0; offset < prompts.length; offset++) {
    const index = (((start + offset) % prompts.length) + prompts.length) % prompts.length;
    if (!prompts[index].hidden) return index;
  }
  return -1;
}
export { defaults, cleanText, validate, nextIndex };
export default Object.freeze({
  defaults,
  cleanText,
  validate,
  nextIndex,
});
