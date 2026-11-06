import { describe, expect, it } from "vitest";
import type { Fetch } from "./channels";
import { createExpoPushSender } from "./expo";
import { createResendSender } from "./resend";
import {
  isQuiet,
  looksCommercial,
  messageDigestNotification,
  nextAllowedAt,
  nudgeNotification,
  renderEmail,
  sessionReminderNotification,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from "./rules";
import { codeText, createCodeSender, createSenders } from "./setup";
import { createTwilioSender } from "./twilio";
import { createVonageSender } from "./vonage";

interface Call {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** fetch simulé : enregistre les appels et répond ce qu'on lui dit. */
function fakeFetch(status = 200, json: unknown = {}) {
  const calls: Call[] = [];
  const fetcher: Fetch = async (url, init) => {
    calls.push({ url, headers: init.headers, body: init.body });
    return { ok: status < 300, status, json: async () => json };
  };
  return { calls, fetcher };
}

const failingFetch: Fetch = async () => {
  throw new Error("réseau coupé");
};

const PHONE = "+22900000001";

describe("Twilio", () => {
  const config = {
    accountSid: "AC123",
    authToken: "jeton",
    smsFrom: "+15550000000",
    whatsappFrom: "+15550000001",
  };

  it("SMS : formulaire, authentification de base, identifiant renvoyé", async () => {
    const f = fakeFetch(201, { sid: "SM1" });
    const sender = createTwilioSender(config, f.fetcher);
    expect(sender.channels).toEqual(["sms", "whatsapp"]);
    const r = await sender.send({ channel: "sms", to: PHONE, body: "Bonjour" });
    expect(r).toEqual({ ok: true, value: { provider: "twilio", ref: "SM1" } });
    const call = f.calls[0];
    expect(call?.url).toBe(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
    );
    expect(call?.headers.authorization).toBe(
      `Basic ${Buffer.from("AC123:jeton").toString("base64")}`,
    );
    const form = new URLSearchParams(call?.body);
    expect(form.get("To")).toBe(PHONE);
    expect(form.get("From")).toBe("+15550000000");
    expect(form.get("Body")).toBe("Bonjour");
  });

  it("WhatsApp : préfixe whatsapp:, modèle approuvé s'il est configuré", async () => {
    const f = fakeFetch(201, { sid: "SM2" });
    const sender = createTwilioSender(
      { ...config, whatsappCodeContentSid: "HXcode" },
      f.fetcher,
    );
    await sender.send({
      channel: "whatsapp",
      to: PHONE,
      body: "Votre code 123456",
      template: { purpose: "code", variables: ["123456"] },
    });
    const form = new URLSearchParams(f.calls[0]?.body);
    expect(form.get("To")).toBe(`whatsapp:${PHONE}`);
    expect(form.get("From")).toBe("whatsapp:+15550000001");
    expect(form.get("ContentSid")).toBe("HXcode");
    expect(form.get("ContentVariables")).toBe(JSON.stringify({ 1: "123456" }));
    expect(form.get("Body")).toBeNull();

    // Sans modèle de notification : texte libre.
    await sender.send({
      channel: "whatsapp",
      to: PHONE,
      body: "Texte",
      template: { purpose: "notification", variables: ["Texte"] },
    });
    expect(new URLSearchParams(f.calls[1]?.body).get("Body")).toBe("Texte");
  });

  it("erreurs : 429 et 5xx réessayables, 400 non, réseau réessayable", async () => {
    const s429 = createTwilioSender(config, fakeFetch(429).fetcher);
    const s400 = createTwilioSender(config, fakeFetch(400).fetcher);
    const net = createTwilioSender(config, failingFetch);
    const m = { channel: "sms" as const, to: PHONE, body: "x" };
    expect(await s429.send(m)).toMatchObject({
      ok: false,
      error: { reason: "twilio_http_429", retryable: true },
    });
    expect(await s400.send(m)).toMatchObject({
      ok: false,
      error: { reason: "twilio_http_400", retryable: false },
    });
    expect(await net.send(m)).toMatchObject({
      ok: false,
      error: { reason: "twilio_network", retryable: true },
    });
  });

  it("canal sans numéro d'envoi : indisponible", async () => {
    const sender = createTwilioSender(
      { accountSid: "AC1", authToken: "t", smsFrom: "+15550000000" },
      fakeFetch().fetcher,
    );
    expect(sender.channels).toEqual(["sms"]);
    expect(
      await sender.send({ channel: "whatsapp", to: PHONE, body: "x" }),
    ).toMatchObject({ ok: false, error: { retryable: false } });
  });
});

describe("Vonage", () => {
  it("SMS et WhatsApp : JSON, numéros sans +, identifiant renvoyé", async () => {
    const f = fakeFetch(202, { message_uuid: "uuid-1" });
    const sender = createVonageSender(
      {
        apiKey: "cle",
        apiSecret: "secret",
        smsFrom: "Wema",
        whatsappFrom: "+15550000002",
      },
      f.fetcher,
    );
    expect(
      await sender.send({ channel: "sms", to: PHONE, body: "Bonjour" }),
    ).toEqual({ ok: true, value: { provider: "vonage", ref: "uuid-1" } });
    expect(f.calls[0]?.url).toBe("https://api.nexmo.com/v1/messages");
    expect(f.calls[0]?.headers.authorization).toBe(
      `Basic ${Buffer.from("cle:secret").toString("base64")}`,
    );
    expect(JSON.parse(f.calls[0]?.body ?? "")).toEqual({
      message_type: "text",
      channel: "sms",
      to: "22900000001",
      from: "Wema",
      text: "Bonjour",
    });
    await sender.send({ channel: "whatsapp", to: PHONE, body: "Salut" });
    expect(JSON.parse(f.calls[1]?.body ?? "")).toMatchObject({
      channel: "whatsapp",
      from: "15550000002",
    });
  });

  it("WhatsApp : modèle d'authentification avec le bouton du code", async () => {
    const f = fakeFetch(202, { message_uuid: "u" });
    const sender = createVonageSender(
      {
        apiKey: "k",
        apiSecret: "s",
        whatsappFrom: "+15550000002",
        whatsappCodeTemplate: "wema_code",
      },
      f.fetcher,
    );
    await sender.send({
      channel: "whatsapp",
      to: PHONE,
      body: "code",
      template: { purpose: "code", variables: ["654321"] },
    });
    const body = JSON.parse(f.calls[0]?.body ?? "");
    expect(body.message_type).toBe("custom");
    expect(body.custom.template.name).toBe("wema_code");
    expect(body.custom.template.language.code).toBe("fr");
    expect(body.custom.template.components).toEqual([
      { type: "body", parameters: [{ type: "text", text: "654321" }] },
      {
        type: "button",
        sub_type: "url",
        index: "0",
        parameters: [{ type: "text", text: "654321" }],
      },
    ]);
  });

  it("erreur 503 réessayable", async () => {
    const sender = createVonageSender(
      { apiKey: "k", apiSecret: "s", smsFrom: "Wema" },
      fakeFetch(503).fetcher,
    );
    expect(
      await sender.send({ channel: "sms", to: PHONE, body: "x" }),
    ).toMatchObject({ ok: false, error: { retryable: true } });
  });
});

describe("Resend", () => {
  it("jeton porteur, en-têtes de désinscription en un clic", async () => {
    const f = fakeFetch(200, { id: "em_1" });
    const sender = createResendSender(
      { apiKey: "re_test", from: "Wema <bonjour@example.test>" },
      f.fetcher,
    );
    const r = await sender.send({
      to: "parent@example.test",
      subject: "Sujet",
      text: "Texte",
      html: "<p>Texte</p>",
      unsubscribeUrl: "https://wema.example/api/notifications/unsubscribe/t",
    });
    expect(r).toEqual({ ok: true, value: { provider: "resend", ref: "em_1" } });
    expect(f.calls[0]?.url).toBe("https://api.resend.com/emails");
    expect(f.calls[0]?.headers.authorization).toBe("Bearer re_test");
    expect(JSON.parse(f.calls[0]?.body ?? "")).toEqual({
      from: "Wema <bonjour@example.test>",
      to: ["parent@example.test"],
      subject: "Sujet",
      text: "Texte",
      html: "<p>Texte</p>",
      headers: {
        "List-Unsubscribe":
          "<https://wema.example/api/notifications/unsubscribe/t>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  });
});

describe("choix des prestataires", () => {
  it("sans variable : console en développement, rien en production", () => {
    const dev = createSenders({}, { production: false });
    expect(dev.senders.sms?.provider).toBe("console");
    expect(dev.senders.email?.provider).toBe("console");
    const prod = createSenders({}, { production: true });
    expect(prod.senders).toMatchObject({
      sms: null,
      whatsapp: null,
      email: null,
    });
    // Push Expo : aucun compte nécessaire, toujours disponible.
    expect(prod.senders.push?.provider).toBe("expo");
  });

  it("Twilio en premier, Vonage si demandé ; Resend exige un expéditeur", () => {
    const env = {
      TWILIO_ACCOUNT_SID: "AC1",
      TWILIO_AUTH_TOKEN: "t",
      TWILIO_SMS_FROM: "+15550000000",
      VONAGE_API_KEY: "k",
      VONAGE_API_SECRET: "s",
      VONAGE_SMS_FROM: "Wema",
      VONAGE_WHATSAPP_FROM: "+15550000002",
      RESEND_API_KEY: "re_x",
    };
    const a = createSenders(env, { production: true });
    expect(a.senders.sms?.provider).toBe("twilio");
    expect(a.senders.whatsapp?.provider).toBe("vonage");
    expect(a.senders.email).toBeNull();
    expect(a.problems.join()).toContain("WEMA_EMAIL_FROM");
    const b = createSenders(
      { ...env, WEMA_SMS_PROVIDER: "vonage", WEMA_EMAIL_FROM: "w@x.test" },
      { production: true },
    );
    expect(b.senders.sms?.provider).toBe("vonage");
    expect(b.senders.email?.provider).toBe("resend");
  });

  it("code de connexion : par le canal choisi, texte court", async () => {
    const f = fakeFetch(201, { sid: "SM9" });
    const { senders } = createSenders(
      {
        TWILIO_ACCOUNT_SID: "AC1",
        TWILIO_AUTH_TOKEN: "t",
        TWILIO_SMS_FROM: "+15550000000",
        TWILIO_WHATSAPP_FROM: "+15550000001",
      },
      { production: true, fetch: f.fetcher },
    );
    const codes = createCodeSender(senders);
    expect(
      await codes.send({ channel: "whatsapp", to: PHONE, code: "123456" }),
    ).toEqual({ ok: true, value: undefined });
    const form = new URLSearchParams(f.calls[0]?.body);
    expect(form.get("To")).toBe(`whatsapp:${PHONE}`);
    expect(form.get("Body")).toBe(codeText("123456"));
    expect(codeText("123456").length).toBeLessThanOrEqual(160);
    // Production sans prestataire e-mail ni Vonage : canal indisponible = échec.
    const none = createCodeSender({ sms: null, whatsapp: null, email: null });
    expect(
      await none.send({ channel: "sms", to: PHONE, code: "1" }),
    ).toMatchObject({ ok: false, error: { kind: "send_failed" } });
  });
});

describe("heures calmes selon le fuseau", () => {
  const q = { timeZone: "Africa/Porto-Novo", start: 21, end: 8 }; // UTC+1

  it("calme la nuit, pas en journée", () => {
    expect(isQuiet(new Date("2026-11-03T21:30:00Z"), q)).toBe(true); // 22 h 30
    expect(isQuiet(new Date("2026-11-03T06:59:00Z"), q)).toBe(true); // 7 h 59
    expect(isQuiet(new Date("2026-11-03T07:00:00Z"), q)).toBe(false); // 8 h
    expect(isQuiet(new Date("2026-11-03T19:59:00Z"), q)).toBe(false); // 20 h 59
    expect(isQuiet(new Date("2026-11-03T20:00:00Z"), q)).toBe(true); // 21 h
  });

  it("le même instant n'est pas calme partout", () => {
    const at = new Date("2026-11-03T13:00:00Z");
    expect(isQuiet(at, { ...q, timeZone: "Pacific/Auckland" })).toBe(true); // 2 h
    expect(isQuiet(at, q)).toBe(false); // 14 h
  });

  it("fin des heures calmes : 8 h locales", () => {
    expect(
      nextAllowedAt(new Date("2026-11-03T21:30:00Z"), q).toISOString(),
    ).toBe("2026-11-04T07:00:00.000Z");
    const day = new Date("2026-11-03T12:00:00Z");
    expect(nextAllowedAt(day, q)).toBe(day);
  });

  it("plage dans la journée, plage vide, fuseau absent (UTC)", () => {
    const lunch = { timeZone: null, start: 12, end: 14 };
    expect(isQuiet(new Date("2026-11-03T12:10:00Z"), lunch)).toBe(true);
    expect(isQuiet(new Date("2026-11-03T14:00:00Z"), lunch)).toBe(false);
    expect(
      isQuiet(new Date("2026-11-03T03:00:00Z"), {
        timeZone: null,
        start: 5,
        end: 5,
      }),
    ).toBe(false);
  });

  it("changement d'heure (Paris, 29 mars 2026) : on sort bien des heures calmes", () => {
    const paris = { timeZone: "Europe/Paris", start: 21, end: 8 };
    const at = nextAllowedAt(new Date("2026-03-28T23:00:00Z"), paris);
    expect(isQuiet(at, paris)).toBe(false);
    expect(at.toISOString()).toBe("2026-03-29T06:00:00.000Z"); // 8 h CEST
  });
});

describe("désinscription signée", () => {
  const user = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

  it("aller-retour, court, propre à la personne et à la sorte", () => {
    const t = unsubscribeToken("secret", user, "message");
    expect(t.length).toBeLessThan(45);
    expect(verifyUnsubscribeToken("secret", t)).toEqual({
      userId: user,
      kind: "message",
    });
    expect(
      verifyUnsubscribeToken(
        "secret",
        unsubscribeToken("secret", user, "nudge"),
      )?.kind,
    ).toBe("nudge");
  });

  it("refusé : autre secret, jeton modifié, n'importe quoi", () => {
    const t = unsubscribeToken("secret", user, "nudge");
    expect(verifyUnsubscribeToken("autre", t)).toBeNull();
    const tampered = `${t.slice(0, 5)}${t[5] === "A" ? "B" : "A"}${t.slice(6)}`;
    expect(verifyUnsubscribeToken("secret", tampered)).toBeNull();
    expect(verifyUnsubscribeToken("secret", "abc")).toBeNull();
    expect(verifyUnsubscribeToken("secret", "x".repeat(40))).toBeNull();
  });
});

describe("textes des notifications", () => {
  it("élève : le texte de la relance ; jamais de contenu commercial", () => {
    expect(
      nudgeNotification({
        recipient: "learner",
        nudgeText: "Un exercice t'attend. On le termine ensemble ?",
        childName: "Élève",
      }).text,
    ).toBe("Un exercice t'attend. On le termine ensemble ?");
    const promo = nudgeNotification({
      recipient: "learner",
      nudgeText: "Profite de notre offre premium à -50 % !",
      childName: "Élève",
    });
    expect(looksCommercial(promo.text)).toBe(false);
    expect(promo.text).toContain("Wema");
  });

  it("parent : vouvoiement, bienveillant, sans détail sur l'élève", () => {
    const n = nudgeNotification({
      recipient: "guardian",
      nudgeText: "Texte de l'élève, non repris",
      childName: "Élève Un",
    });
    expect(n.text).toContain("Élève Un");
    expect(n.text).toContain("votre part");
    expect(n.text).not.toContain("non repris");
  });

  it("messages regroupés : le nombre seulement, tu ou vous", () => {
    expect(messageDigestNotification("learner", 1).text).toBe(
      "Tu as un nouveau message sur Wema.",
    );
    expect(messageDigestNotification("adult", 3).text).toBe(
      "Vous avez 3 nouveaux messages sur Wema.",
    );
  });

  it("e-mail : HTML échappé, lien de désinscription", () => {
    const e = renderEmail({ subject: "S", text: "<b>x</b>" }, "adult", {
      appUrl: "https://w.test/",
      unsubscribeUrl: "https://w.test/u",
    });
    expect(e.html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(e.html).toContain('href="https://w.test/u"');
    expect(e.text).toContain("https://w.test/u");
  });
});

describe("push Expo", () => {
  const A = "ExponentPushToken[a]";
  const B = "ExponentPushToken[b]";

  it("envoi : JSON, jeton d'accès facultatif, un ticket par message", async () => {
    const f = fakeFetch(200, {
      data: [
        { status: "ok", id: "t-1" },
        {
          status: "error",
          message: "« ExponentPushToken[b] » n'est pas inscrit",
          details: { error: "DeviceNotRegistered" },
        },
      ],
    });
    const sender = createExpoPushSender({ accessToken: "jeton" }, f.fetcher);
    const r = await sender.send([
      { to: A, title: "Wema", body: "Bonjour", data: { path: "/" } },
      { to: B, title: "Wema", body: "Bonjour" },
    ]);
    expect(r).toEqual({
      ok: true,
      value: [
        { to: A, ok: true, id: "t-1" },
        { to: B, ok: false, error: "DeviceNotRegistered" },
      ],
    });
    const call = f.calls[0];
    expect(call?.url).toBe("https://exp.host/--/api/v2/push/send");
    expect(call?.headers.authorization).toBe("Bearer jeton");
    expect(JSON.parse(call?.body ?? "")).toEqual([
      {
        to: A,
        title: "Wema",
        body: "Bonjour",
        sound: "default",
        data: { path: "/" },
      },
      { to: B, title: "Wema", body: "Bonjour", sound: "default" },
    ]);
    // Sans jeton d'accès : pas d'en-tête d'autorisation.
    const g = fakeFetch(200, { data: [{ status: "ok", id: "t-2" }] });
    await createExpoPushSender({}, g.fetcher).send([
      { to: A, title: "Wema", body: "x" },
    ]);
    expect(g.calls[0]?.headers.authorization).toBeUndefined();
  });

  it("plus de 100 messages : plusieurs appels", async () => {
    const calls: number[] = [];
    const fetcher: Fetch = async (_url, init) => {
      const n = (JSON.parse(init.body) as unknown[]).length;
      calls.push(n);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: Array.from({ length: n }, (_, i) => ({
            status: "ok",
            id: `t${i}`,
          })),
        }),
      };
    };
    const r = await createExpoPushSender({}, fetcher).send(
      Array.from({ length: 150 }, () => ({ to: A, title: "W", body: "x" })),
    );
    expect(calls).toEqual([100, 50]);
    expect(r.ok && r.value).toHaveLength(150);
  });

  it("erreurs : 429 réessayable, réponse illisible non, réseau réessayable", async () => {
    const m = [{ to: A, title: "W", body: "x" }];
    expect(
      await createExpoPushSender({}, fakeFetch(429).fetcher).send(m),
    ).toMatchObject({
      ok: false,
      error: { reason: "expo_http_429", retryable: true },
    });
    expect(
      await createExpoPushSender({}, fakeFetch(200, { data: [] }).fetcher).send(
        m,
      ),
    ).toMatchObject({
      ok: false,
      error: { reason: "expo_bad_response", retryable: false },
    });
    expect(await createExpoPushSender({}, failingFetch).send(m)).toMatchObject({
      ok: false,
      error: { reason: "expo_network", retryable: true },
    });
  });

  it("reçus : ok, ou code d'erreur court", async () => {
    const f = fakeFetch(200, {
      data: {
        "t-1": { status: "ok" },
        "t-2": { status: "error", details: { error: "DeviceNotRegistered" } },
        "t-3": { status: "error", message: "texte libre" },
      },
    });
    const r = await createExpoPushSender({}, f.fetcher).receipts([
      "t-1",
      "t-2",
      "t-3",
    ]);
    expect(f.calls[0]?.url).toBe("https://exp.host/--/api/v2/push/getReceipts");
    expect(JSON.parse(f.calls[0]?.body ?? "")).toEqual({
      ids: ["t-1", "t-2", "t-3"],
    });
    expect(r.ok && Object.fromEntries(r.value)).toEqual({
      "t-1": { ok: true },
      "t-2": { ok: false, error: "DeviceNotRegistered" },
      "t-3": { ok: false, error: "error" },
    });
  });
});

describe("rappels de séance : textes", () => {
  const startsAt = new Date("2026-11-04T14:00:00Z");
  const base = {
    startsAt,
    timeZone: "Africa/Porto-Novo",
    teacherName: "Prof Un",
    title: "Fractions",
    groupName: null,
  };

  it("heure locale du destinataire ; tu pour l'élève, vous pour les adultes", () => {
    const learner = sessionReminderNotification({
      ...base,
      role: "learner",
      reminder: "24h",
    });
    expect(learner.text).toBe(
      "Rappel : ta séance « Fractions » avec Prof Un commence le mercredi 4 novembre à 15:00.",
    );
    const parent = sessionReminderNotification({
      ...base,
      role: "guardian",
      reminder: "1h",
    });
    expect(parent.text).toContain("de votre enfant avec Prof Un");
    expect(parent.text).toContain("dans moins d'une heure");
    const prof = sessionReminderNotification({
      ...base,
      role: "teacher",
      reminder: "24h",
      timeZone: null,
      groupName: "Révisions",
    });
    expect(prof.text).toBe(
      "Rappel : votre séance « Fractions » (groupe Révisions) commence le mercredi 4 novembre à 14:00 (UTC).",
    );
  });

  it("élève : un titre commercial n'est pas repris", () => {
    const n = sessionReminderNotification({
      ...base,
      title: "Offre spéciale",
      role: "learner",
      reminder: "1h",
    });
    expect(n.text).not.toContain("Offre");
    expect(looksCommercial(n.text)).toBe(false);
  });
});
