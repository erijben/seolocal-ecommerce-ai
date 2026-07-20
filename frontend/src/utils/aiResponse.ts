const DEMO_BLOCK_REGEX =
  /## Mode démo intelligent activé[\s\S]*?Le système utilise donc l'analyse locale basée sur les vraies données du dashboard\.\s*/g;


export function cleanAiResponse(text?: string | null) {
  if (!text) {
    return "";
  }

  return text
    .replace(DEMO_BLOCK_REGEX, "")
    .replace(/## Mode démo intelligent activé/g, "")
    .replace(/OpenAI n'est pas disponible actuellement ou le quota API est insuffisant\./g, "")
    .replace(/Le système utilise donc l'analyse locale basée sur les vraies données du dashboard\./g, "")
    .replace(/## Réponse IA démo\s*—/g, "Réponse de l’assistant IA —")
    .replace(/## Réponse IA démo\s*-/g, "Réponse de l’assistant IA —")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*-\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}