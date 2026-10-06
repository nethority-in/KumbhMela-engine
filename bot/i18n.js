"use strict";

/* Reply text in en / hi / mr.
   Rules this file exists to enforce:
   - never "safe" / "unsafe"
   - never "avoid this day" or "best day"
   - every crowd figure is labelled an estimate
   - no exclamation marks (project tone rule)
   - facts come from JSON, never from a model */

const T = {
  en: {
    greet:
      "Namaste. I share information about the Simhastha Kumbh Mela 2027 at Nashik and Trimbakeshwar.\n\n" +
      "I can tell you:\n" +
      "- every auspicious bathing day\n" +
      "- estimated crowd level for a day\n" +
      "- quieter days with fewer people\n" +
      "- which water, where\n" +
      "- emergency numbers\n\n" +
      "Ask in Hindi, Marathi or English.",
    unknown:
      "I did not understand that. I can answer questions about auspicious days, estimated crowd levels, quieter days, the two waters, and emergency numbers.\n\n" +
      "Try: which days are auspicious, or which day is quieter.",
    thanks: "You are welcome. Travel gently.",
    estimateWord: "Estimated",
    tail:
      "These are estimates, not official announcements. Confirm dates and arrangements with the mela authorities, and always follow police and administration instruction on the day.",
    quietHeadline: "Quieter auspicious days",
    quietIntro:
      "These days are far less crowded than the three royal baths. The water is the same water.",
    allDaysIntro:
      "Every auspicious day the engine computed, with the estimated crowd band.",
    royalHeadline: "The three royal baths",
    royalIntro:
      "These are the busiest days of the season. They carry the akhara processions. If you want the procession, these are the days. If you want quiet, ask for quieter days.",
    crowdHeadline: "How we estimate crowds",
    crowdBands: "Very High, High, Moderate, Lower. The band comes from published rules, not from measured attendance.",
    crowdPeak: "Only three days score High in the whole season. The other ninety-nine are quieter.",
    watersHeadline: "Two waters, one river",
    watersRam:
      "Ramkund, Nashik — on the Godavari, in the city at Panchavati.",
    watersKush:
      "Kushavarta Kund, Trimbakeshwar — the source of the Godavari, about thirty kilometres west, beside a Jyotirlinga.",
    watersNote:
      "Which order bathes where is traditionally recorded one way, but accounts differ and arrangements can change from one mela to the next. Treat it as background and confirm the current plan with local authorities before you travel.",
    helplineHeadline: "Emergency",
    helplineConfirmed: "National emergency number: 112",
    helplineMela:
      "Mela control-room numbers change for each event and must be read from the official notice board on the day. Please confirm them locally.",
    akharaNote:
      "On which day which sadhus bathe, and who bathes at which kund, is not something I will guess at. Sources disagree. Please confirm with the akhara itself or the mela authorities.",
    quietWhy:
      "These carry a smaller religious rank, with no festival or weekend surge on top.",
    reachMsg:
      "Travel information is published on our website, which carries the current details for Nashik and Trimbakeshwar.",
    reachNoGuess:
      "I do not keep travel routes in my data, so I will not guess at timings or distances. Please read the guide there before you set out.",
    noData: "The calendar data is not available right now. Please try again shortly.",
  },

  hi: {
    greet:
      "नमस्ते। मैं 2027 के नाशिक-त्रिम्बकेश्वर सिंहस्थ कुंभ मेले की जानकारी देता हूँ।\n\n" +
      "मैं बता सकता हूँ:\n" +
      "- शुभ स्नान के सभी दिन\n" +
      "- किसी दिन की अनुमानित भीड़\n" +
      "- कम भीड़ वाले शांत दिन\n" +
      "- कौन सा जल, कहाँ\n" +
      "- आपातकालीन नंबर\n\n" +
      "हिंदी, मराठी या अंग्रेजी में पूछिए।",
    unknown:
      "यह समझ नहीं आया। मैं शुभ दिन, अनुमानित भीड़, शांत दिन, दो जल और आपातकालीन नंबर के बारे में बता सकता हूँ।\n\n" +
      "पूछिए: कौन से दिन शुभ हैं, या कौन सा दिन शांत है।",
    thanks: "स्वागत है। यात्रा कोमल हो।",
    estimateWord: "अनुमानित",
    tail:
      "ये अनुमान हैं, आधिकारिक घोषणा नहीं। तारीख और व्यवस्था मेला अधिकारियों से पुष्ट करें, और उस दिन पुलिस तथा प्रशासन के निर्देश का पालन करें।",
    quietHeadline: "कम भीड़ वाले शुभ दिन",
    quietIntro:
      "ये दिन तीन राजा स्नान से कहीं ज्यादा शांत हैं। जल वही है।",
    allDaysIntro:
      "इंजन द्वारा गणना किए गए सभी शुभ दिन, अनुमानित भीड़ पट्टी के साथ।",
    royalHeadline: "तीन राजा स्नान",
    royalIntro:
      "ये सीज़न के सबसे व्यस्त दिन हैं। यहीं अखारा की शाही यात्रा होती है। यात्रा चाहिए तो ये दिन, शांति चाहिए तो शांत दिन पूछिए।",
    crowdHeadline: "भीड़ का अनुमान कैसे लगाते हैं",
    crowdBands: "बहुत अधिक, अधिक, मध्यम, कम। यह पट्टी प्रकाशित नियमों से आती है, मापे गई भीड़ से नहीं।",
    crowdPeak: "पूरे सीज़न में सिर्फ तीन दिन 'अधिक' हैं। बाकी निन्यानबे शांत हैं।",
    watersHeadline: "दो जल, एक नदी",
    watersRam: "रामकुंड, नाशिक — गोदावरी पर, पंचवटी में।",
    watersKush: "कुषावर्त कुंड, त्रिम्बकेश्वर — गोदावरी का उद्गम, लगभग तीस किलोमीटर पश्चिम, एक ज्योतिर्लिंग के पास।",
    watersNote:
      "कौन सा अखारा किस कुंड पर स्नान करता है, यह परंपरागत रूप से एक तरह से दर्ज है, पर स्रोत भिन्न हैं और व्यवस्था हर मेले में बदल सकती है। यह पृष्ठभूमि मानें और यात्रा से पहले स्थानीय अधिकारियों से पुष्टि करें।",
    helplineHeadline: "आपातकाल",
    helplineConfirmed: "राष्ट्रीय आपात नंबर: 112",
    helplineMela:
      "मेला कंट्रोल रूम के नंबर हर आयोजन में बदलते हैं और उस दिन की आधिकारिक सूचना से पढ़े जाने चाहिए। कृपया स्थानीय स्तर पर पुष्टि करें।",
    akharaNote:
      "किस दिन कौन से साधु स्नान करेंगे, और कौन किस कुंड पर, यह मैं अंदाज़ा नहीं लगाऊँगा। स्रोत भिन्न हैं। कृपया अखारे या मेला अधिकारियों से पुष्टि करें।",
    quietWhy:
      "इन दिनों का धार्मिक दर्जा छोटा है, और इन पर कोई त्योहार या सप्ताहांत का अतिरिक्त दबाव नहीं पड़ता।",
    reachMsg:
      "यात्रा की जानकारी हमारी वेबसाइट पर प्रकाशित है, जहां नाशिक और त्रिम्बकेश्वर का मौजूदा विवरण दिया गया है।",
    reachNoGuess:
      "मेरे पास यात्रा मार्ग मेरे आंकड़ों में नहीं हैं, इसलिए मैं समय या दूरी का अंदाज़ा नहीं लगाऊँगा। कृपया निकलने से पहले वहाँ की मार्गदर्शिका पढ़ें।",
    noData: "अभी पंचांग आंकड़े उपलब्ध नहीं हैं। कृपया थोड़ी देर बाद प्रयास करें।",
  },

  mr: {
    greet:
      "नमस्कार। मी २०२७ च्या नाशिक-त्रिम्बकेश्वर सिंहस्थ कुंभ मेळ्याची माहिती देतो.\n\n" +
      "मी सांगू शकतो:\n" +
      "- शुभ स्नानाचे सर्व दिवस\n" +
      "- कोणत्या दिवशी अंदाजे भीड\n" +
      "- कमी भीड असलेले शांत दिवस\n" +
      "- कोणती वाहिण, कुठे\n" +
      "- आणीबाणी क्रमांक\n\n" +
      "हिंदी, मराठी किंवा इंग्रजीत विचारा.",
    unknown:
      "हे समजले नाही. मी शुभ दिवस, अंदाजे भीड, शांत दिवस, दोन वाहिणा आणि आणीबाणी क्रमांकाबद्दल सांगू शकतो.\n\n" +
      "विचारा: कोणते दिवस शुभ आहेत, किंवा कोणता दिवस शांत आहे.",
    thanks: "स्वागत आहे. प्रवास सौम्य असावा.",
    estimateWord: "अंदाजे",
    tail:
      "हे अंदाजे आहेत, अधिकृत घोषणा नाहीत. तारीख व व्यवस्था मेळा अधिकाऱ्यांकडून खात्री करा, आणि त्या दिवशी पोलीस व प्रशासनाच्या सूचनांचे पालन करा.",
    quietHeadline: "कमी भीड असलेले शुभ दिवस",
    quietIntro:
      "हे दिवस तीन राजा स्नानापेक्षा कितीतरी शांत आहेत. वाहिण तीच आहे.",
    allDaysIntro:
      "इंजिनाने गणित केलेले सर्व शुभ दिवस, अंदाजे भीड पट्टीसह.",
    royalHeadline: "तीन राजा स्नान",
    royalIntro:
      "हे हंगामीच्या सर्वात व्यस्त दिवस आहेत. इथे अखार्यांची शाही यात्रा होते. यात्रा हवी असेल तर हे दिवस, शांतता हवी असेल तर शांत दिवस विचारा.",
    crowdHeadline: "भीडचा अंदाज कसा काढतो",
    crowdBands: "खूप जास्त, जास्त, मध्यम, कमी. ही पट्टी प्रसिद्ध नियमांवरून येते, मोजलेल्या भीडवरून नाही.",
    crowdPeak: "संपूर्ण हंगामात फक्त तीन दिवस 'जास्त' आहेत. उर्वीत नव्याण्ये शांत आहेत.",
    watersHeadline: "दोन वाहिणा, एक नदी",
    watersRam: "रामकुंड, नाशिक — गोदावरीवर, पंचवटीत.",
    watersKush: "कुषावर्त कुंड, त्रिम्बकेश्वर — गोदावरीचा उगम, सुमारे तीस किलोमीटर पश्चिम, एका ज्योतिर्लिंगाजवळ.",
    watersNote:
      "कोणता अखारा कुठल्या कुंडावर स्नान करतो, हे परंपरेने एकप्रकारे नोंदवलेले आहे, परंतु स्रोत वेगवेगळे आहेत आणि व्यवस्था प्रत्येक मेळ्यात बदलू शकते. हे पार्श्वभूमी मानून प्रवासापूर्वी स्थानिक अधिकाऱ्यांकडून खात्री करा.",
    helplineHeadline: "आणीबाणी",
    helplineConfirmed: "राष्ट्रीय आणीबाणी क्रमांक: 112",
    helplineMela:
      "मेळा कंट्रोल रुमचे क्रमांक प्रत्येक आयोजनात बदलतात आणि त्या दिवशीच्या अधिकृत सूचनेवरून वाचायला हवेत. कृपया स्थानिक पातळीवर खात्री करा.",
    akharaNote:
      "कोणत्या दिवशी कोणते संत स्नान करतील, आणि कोण कोणत्या कुंडावर, हे मी अंदाज लावणार नाही. स्रोत वेगवेगळे आहेत. कृपया अखारा किंवा मेळा अधिकाऱ्यांकडून खात्री करा.",
    quietWhy:
      "या दिवसांचा धार्मिक दर्जा कमी आहे, आणि त्यावर कोणतेही सण किंवा सप्ताहांताचा अतिरिक्त दबाव येत नाही.",
    reachMsg:
      "प्रवासाची माहिती आमच्या संकेतस्थळावर प्रकाशित आहे, जिथे नाशिक आणि त्रिम्बकेश्वरचा सध्याचा तपशील दिला आहे.",
    reachNoGuess:
      "प्रवासाचे मार्ग माझ्या आकड्यांमध्ये नाहीत, म्हणून मी वेळ किंवा अंतराचा अंदाज लावणार नाही. कृपया निघण्यापूर्वी तिथीली मार्गदर्शिका वाचा.",
    noData: "सध्या पंचांग माहिती उपलब्ध नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा.",
  },
};

const DATES = {
  en: {
    label: (s) => s,
    quietNote: "Why quieter:",
    bandLine: (band) => `${band.label_en} crowd`,
    panchang: (p) => `Panchang — ${[p.tithi, p.nakshatra, p.masa, p.weekday].filter(Boolean).join(", ")}`,
    royalTag: "Royal bath (Amrit Snan)",
    majorTag: "Major bathing day",
    minorTag: "Auspicious day",
    estTag: (b) => `${b.label_en} (estimated)`,
  },
  hi: {
    label: (s) => s,
    quietNote: "कम भीड़ का कारण:",
    bandLine: (band) => `${band.label_hi} भीड़`,
    panchang: (p) => `पंचांग — ${[p.tithi, p.nakshatra, p.masa, p.weekday].filter(Boolean).join(", ")}`,
    royalTag: "राजा स्नान (अमृत स्नान)",
    majorTag: "प्रमुख स्नान दिवस",
    minorTag: "शुभ दिवस",
    estTag: (b) => `${b.label_hi} (अनुमानित)`,
  },
  mr: {
    label: (s) => s,
    quietNote: "कमी भीडीचे कारण:",
    bandLine: (band) => `${band.label_mr} भीड`,
    panchang: (p) => `पंचांग — ${[p.tithi, p.nakshatra, p.masa, p.weekday].filter(Boolean).join(", ")}`,
    royalTag: "राजा स्नान (अमृत स्नान)",
    majorTag: "प्रमुख स्नान दिवस",
    minorTag: "शुभ दिवस",
    estTag: (b) => `${b.label_mr} (अंदाजे)`,
  },
};

module.exports = { T, DATES };
