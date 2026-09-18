const texts = [
  "How can design contribute to Vietnam's future?",
  "What should a design festival represent?",
  "Who should a design festival be for?",
  "Would you help shape the next festival?",
  "Whose voices are missing from Vietnam's design conversations?",
  "What should an annual design festival make possible?",
  "How can design change the place you live?",
  "Which local issue deserves more creative attention?",
  "What would make the festival feel truly public?",
  "How can design protect culture while creating change?",
  "What everyday system would you redesign first?",
  "How could a festival continue after the event ends?",
];
const defaults = Object.freeze(
  texts.map((text, index) =>
    Object.freeze({
      id: `default-${index + 1}`,
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
