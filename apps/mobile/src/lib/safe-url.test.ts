import { describe, expect, it } from "vitest";
import { isSafeApiUrl } from "./safe-url";

describe("adresses envoyées à l'API", () => {
  it("accepte les chemins ordinaires", () => {
    expect(
      isSafeApiUrl(
        "https://api.wema.test/api/messages/threads/0b6f4f1e-2c4c-4a8e-9a43-5b0d1c2e3f40/read",
      ),
    ).toBe(true);
    expect(isSafeApiUrl("https://api.wema.test/api/learner/variants?x=1")).toBe(
      true,
    );
  });

  it("refuse un identifiant de lien profond qui remonte vers une autre route (jeton Bearer détourné)", () => {
    // wema://conversation/..%2F..%2Fagenda%2Fsessions%2Fabc%2Fcancel%3F : expo-router décode le paramètre.
    expect(
      isSafeApiUrl(
        "https://api.wema.test/api/messages/threads/../../agenda/sessions/abc/cancel?/read",
      ),
    ).toBe(false);
    expect(isSafeApiUrl("https://api.wema.test/api/messages/threads/..")).toBe(
      false,
    );
    expect(isSafeApiUrl("https://api.wema.test/api/x/./y")).toBe(false);
    expect(isSafeApiUrl("https://api.wema.test/api/x/%2e%2e/y")).toBe(false);
  });
});
