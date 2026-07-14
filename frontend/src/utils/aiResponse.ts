const DEMO_MARKER = "## Mode démo intelligent activé";

export function isDemoAiResponse(text?: string | null) {
  if (!text) {
    return false;
  }

  return (
    text.includes(DEMO_MARKER) ||
    text.includes("Réponse IA démo") ||
    text.includes("Mode démo intelligent")
  );
}

export function cleanAiResponse(text?: string | null) {
  if (!text) {
    return "";
  }

  return text.replace(DEMO_MARKER, "").trim();
}