import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { transcript, targetLanguage, action } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      await new Promise(resolve => setTimeout(resolve, 500)); 
      if (action === 'translate') {
        // Fallback mapping if API key is missing
        const translations: Record<string, string> = {
          "Telugu": "హాయ్",
          "Hindi": "नमस्ते",
          "Tamil": "வணக்கம்",
          "Kannada": "ನಮಸ್ಕಾರ",
          "Malayalam": "ഹലോ"
        };
        const translatedWord = translations[targetLanguage] || transcript;
        return NextResponse.json({ translatedText: translatedWord });
      }
      return NextResponse.json({
        symptoms: ["Sharp pain", "Discomfort"],
        location: "Lower abdomen",
        duration: "Since yesterday evening",
        severity: "Moderate to High",
        aggravators: ["Standing up", "Walking"],
        red_flags: ["Potential appendicitis", "Acute pain"],
        missing_info: ["Presence of fever", "Nausea or vomiting"]
      });
    }

    if (action === 'translate') {
      const transRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content: `You are an expert translator. Translate the given English sign language transcript directly into fluent script for ${targetLanguage}. Provide ONLY the translated text in the native script of ${targetLanguage}, with no extra explanations or English characters.`
            },
            { role: "user", content: transcript }
          ]
        })
      });
      const transData = await transRes.json();
      const translatedText = transData.choices?.[0]?.message?.content?.trim() || transcript;
      return NextResponse.json({ translatedText });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192", 
        messages: [
          {
            role: "system",
            content: `You are a clinical extraction AI. Read the patient transcript and extract the medical data strictly into this JSON format: { "symptoms": [], "location": "", "duration": "", "severity": "", "aggravators": [], "red_flags": [], "missing_info": [] }. Only return the JSON object, no markdown, no other text.`
          },
          { role: "user", content: transcript }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error("API failed:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}