import { describe, expect, it } from "vitest";
import { ADMIN, browser, field, testServer, text } from "./test-helpers";

describe("icône d'une matière par le back-office", () => {
  it("se choisit dans la liste fermée, à la création comme à la modification", async () => {
    const server = await testServer();
    const admin = browser(server.app);
    expect((await admin.post("/auth/login", ADMIN)).status).toBe(200);

    const refused = await admin.post("/admin/curriculum/subjects", {
      code: "chimie",
      name: "Chimie",
      icon: "lucide-flask",
    });
    expect(refused.status).toBe(400);

    const created = await admin.post("/admin/curriculum/subjects", {
      code: "chimie",
      name: "Chimie",
      icon: "chemistry",
    });
    expect(created.status).toBe(200);
    const id = text(created.json, "id");

    expect(
      (
        await admin.patch(`/admin/curriculum/subjects/${id}`, {
          name: "Chimie",
          icon: "<svg>",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await admin.patch(`/admin/curriculum/subjects/${id}`, {
          name: "Chimie",
          icon: "science",
        })
      ).status,
    ).toBe(200);

    const list = await admin.get("/admin/curriculum/subjects");
    const subjects = field(list.json, "subjects");
    expect(Array.isArray(subjects) ? subjects : []).toContainEqual(
      expect.objectContaining({ id, icon: "science" }),
    );
  });
});
