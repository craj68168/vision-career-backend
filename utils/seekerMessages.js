const getSeekerLanguage = (req) => {
  const explicitLanguage = req.headers["x-language"];
  const acceptedLanguage = req.headers["accept-language"];
  const language = String(explicitLanguage || acceptedLanguage || "").toLowerCase();

  return language.startsWith("en") ? "en" : "ja";
};

const seekerMessage = (req, messages) => {
  const language = getSeekerLanguage(req);

  return messages[language] || messages.en || messages.ja || "";
};

module.exports = {
  getSeekerLanguage,
  seekerMessage,
};
