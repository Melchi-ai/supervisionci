export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string"
      ? JSON.parse(req.body)
      : req.body;

    const data = body?.data;

    // 👇 ICI TU AJOUTES LES LOGS
    console.log("API HIT");
    console.log("DATA:", data);
    console.log("KEY:", process.env.GROQ_API_KEY);

    if (!data) {
      return res.status(400).json({
        error: "Missing data in request body"
      });
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            {
              role: "user",
              content: `Génère un rapport professionnel basé sur ces données : ${JSON.stringify(data)}`,
            },
          ],
        }),
      }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Erreur Groq API",
        details: text,
      });
    }

    const result = JSON.parse(text);

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      error: "Erreur serveur IA",
      details: error.message,
    });
  }
}