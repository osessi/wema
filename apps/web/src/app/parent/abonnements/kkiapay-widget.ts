"use client";

// Widget Kkiapay (Mobile Money), chargé seulement au moment de payer. La
// transaction annoncée par le widget est ensuite vérifiée par le serveur
// auprès de Kkiapay : le navigateur n'est jamais cru sur parole.

declare global {
  interface Window {
    openKkiapayWidget?: (options: Record<string, unknown>) => void;
    addSuccessListener?: (
      callback: (response: { transactionId?: string }) => void,
    ) => void;
  }
}

const SCRIPT = "https://cdn.kkiapay.me/k.js";

function loadScript(): Promise<boolean> {
  if (window.openKkiapayWidget) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve(Boolean(window.openKkiapayWidget));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export async function openKkiapay(input: {
  publicKey: string;
  sandbox: boolean;
  amount: number;
  reference: string;
  onSuccess: (transactionId: string) => void;
}): Promise<boolean> {
  if (!(await loadScript())) return false;
  window.addSuccessListener?.((response) => {
    if (response.transactionId) input.onSuccess(response.transactionId);
  });
  window.openKkiapayWidget?.({
    amount: input.amount,
    key: input.publicKey,
    sandbox: input.sandbox,
    position: "center",
    // Référence Wema du paiement, renvoyée par Kkiapay et contrôlée par le serveur.
    data: input.reference,
    partnerId: input.reference,
  });
  return true;
}
