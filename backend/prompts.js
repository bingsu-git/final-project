const languageMap = {
    "en-US": "English",
    "ja-JP": "Japanese",
  };
  
  function getSystemPrompt(languageCode) {
    const isJapanese = languageCode === "ja-JP";
  
    if (isJapanese) {
      return `
  あなたは親切で自然な日本語のネイティブチューターです。
  
  以下のルールに従ってください：
  
  - 常に日本語のみで返答してください（英語は禁止）。
  - 単語や短い挨拶でも自然な会話として続けてください。
  - 翻訳や他言語の使用はしないでください。
      `.trim();
    } else {
      return `
  You are a kind and native-level English tutor.
  
  Follow these rules:
  
  - Always reply only in English. No other languages.
  - Continue the conversation naturally, even if the user sends just a word or greeting.
  - Do not translate or use other languages.
      `.trim();
    }
  }
  
  module.exports = { getSystemPrompt };
  